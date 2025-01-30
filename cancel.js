const Airtable = require('airtable');
const express = require('express');
const cors = require("cors");
const axios = require('axios');
const { log } = require('console');
require('dotenv').config();
const nodemailer = require('nodemailer');


const app = express();
app.use(express.json());

const allowedOrigins = [
  "https://biaw-stage-api.webflow.io",
];
app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
    credentials: true,
  })
);

app.get("/", (req, res) => {
  res.send("Server is running and ready to accept requests.");
});


const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME;
const WEBFLOW_API_KEY = process.env.WEBFLOW_API_KEY;
const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY
const AIRTABLE_TABLE_NAME3 = process.env.AIRTABLE_TABLE_NAME3
const AIRTABLE_TABLE_NAME2 = process.env.AIRTABLE_TABLE_NAME2
const WEBFLOW_COLLECTION_ID2 = process.env.WEBFLOW_COLLECTION_ID2
const stripe = require('stripe')("sk_test_51Q9sSHE1AF8nzqTaSsnaie0CWSIWxwBjkjZpStwoFY4RJvrb87nnRnJ3B5vvvaiTJFaSQJdbYX0wZHBqAmY2WI8z00hl0oFOC8"); // Replace with your Stripe API Key



function logError(context, error) {
  console.error(`[ERROR] ${context}:`, error.message || error);
}

app.get('/keep-alive', (req, res) => {
    res.send('Service is alive');
});


const transporter = nodemailer.createTransport({
    service: 'gmail', // You can change the service based on your email provider
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASSWORD, // Your email password
    },
});

const airtableBase = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);
const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME3}`;
const biawClassesUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Biaw Classes`;



// Function to check if the Payment ID is a Stripe Payment Intent
function isStripePayment(paymentId) {
    return typeof paymentId === "string" && paymentId.startsWith("pi_");
}

//refund
app.post("/api/refund", async (req, res) => {
    try {
        const { id, fields } = req.body;

        if (!id || !fields) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        console.log("Received refund request:", { id, fields });

        const paymentIntentId = fields["Payment ID"];
        const memberId = fields["Field ID (from Biaw Classes)"]?.[0] || null;
        const seatsPurchased = parseInt(fields["Number of seat Purchased"], 10) || 0;
        const custEmail = fields["Email"];
        const uername = fields["Name"];
        const classname = fields["Name (from Biaw Classes)"]?.[0] || null


        let refundSuccessful = false;

        // Process Stripe refund if it's a Stripe payment
        if (isStripePayment(paymentIntentId)) {
            try {
                const refund = await stripe.refunds.create({ payment_intent: paymentIntentId });

                if (refund.status === "succeeded") {
                    console.log(`Stripe refund successful for Payment Intent: ${paymentIntentId}`);
                    refundSuccessful = true;
                } else {
                    console.warn(`Refund failed for Payment Intent: ${paymentIntentId}`);
                }
            } catch (error) {
                console.error(`Error processing Stripe refund: ${error.message}`);
            }
        } else {
            console.log(`Skipping Stripe refund: Payment ID (${paymentIntentId}) is not a Stripe Payment Intent.`);
        }

        // Update Airtable even if no Stripe refund was processed
        try {
            await axios.patch(`${airtableUrl}/${id}`, {
                fields: {
                    "Refund Confirmation": "Confirmed",
                    "Payment Status": "Refunded",
                    "Number of seat Purchased": 0,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Airtable payment record: ${id}`);
        } catch (error) {
            console.error("Error updating Airtable Payment record:", error.message);
        }

        // Update class availability in Biaw Classes
        if (memberId) {
            try {
                const classRecords = await axios.get(`${biawClassesUrl}?filterByFormula={Field ID}='${memberId}'`, {
                    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                });

                if (classRecords.data.records.length > 0) {
                    const classRecord = classRecords.data.records[0];
                    const updatedRemainingSeats = (parseInt(classRecord.fields["Number of seats remaining"], 10) || 0) + seatsPurchased;
                    const updatedTotalSeats = (parseInt(classRecord.fields["Total Number of Purchased Seats"], 10) || 0) - seatsPurchased;

                    await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                        fields: {
                            "Number of seats remaining": updatedRemainingSeats.toString(),
                            "Total Number of Purchased Seats": updatedTotalSeats.toString(),
                        },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Biaw Classes record: ${classRecord.id}`);
                }
            } catch (error) {
                console.error("Error updating Biaw Classes record:", error.message);
            }
        }

        // Update linked multiple class registrations
        const multipleClassRegistrationIds = fields["Multiple Class Registration"] || [];
        for (const multipleClassIdObj of multipleClassRegistrationIds) {
            // If multipleClassIdObj is an object, extract the ID
            const multipleClassId = multipleClassIdObj.id || multipleClassIdObj;  // Access the 'id' property if it's an object, or use the value directly

            if (multipleClassId) {
                try {
                    await axios.patch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/Multiple Class Registration/${multipleClassId}`, {
                        fields: { "Payment Status": "Refunded" },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
                } catch (error) {
                    console.error(`Error updating Multiple Class Registration ID: ${multipleClassId}:`, error.message);
                }
            }
        }

        // Send confirmation email
        if (custEmail) {
            try {
                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                    to: custEmail,
                    subject: "Class Cancellation and Refund Processed Successfully",
                    html: `Dear ${uername},<br><br>
                
We hope this email finds you well.<br><br>
                
We would like to inform you that your refund request for the class <b>${classname}</b> and ${seatsPurchased} seat(s) has been successfully processed. 
The payment status for your purchase has been updated, and the refund has been confirmed.<br><br>
                
If you have any questions or need further assistance, please do not hesitate to contact our support team.<br><br>
                
Thank you for your patience and understanding.<br><br>
                
Best regards,<br>
BIAW Support`
                });
                

                console.log(`Email sent to ${custEmail} for refund request ID: ${id}`);
            } catch (error) {
                console.error(`Error sending refund email to ${custEmail}:`, error.message);
            }
        }

        return res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        console.error("Error handling refund:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

//function  ROII cancelled
const multipleClassRegistrationUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}`;

// POST request to handle Roii cancelation
app.post("/api/roiicancel", async (req, res) => {
    try {
        const { id, fields } = req.body;

        if (!id || !fields) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        console.log("Received refund request:", { id, fields });

        const memberId = fields["Field ID (from Biaw Classes)"]?.[0] || null;
        const seatsPurchased = parseInt(fields["Number of seat Purchased"], 10) || 0;
        const custEmail = fields["Email"];
        const uername = fields["Name"];
        const classname = fields["Name (from Biaw Classes)"]?.[0] || null


        // Update Airtable - Refund Confirmation and Payment Status
        try {
            await axios.patch(`${airtableUrl}/${id}`, {
                fields: {
                    "Refund Confirmation": "Confirmed",
                    "Payment Status": "ROII-Cancelled",
                    "Number of seat Purchased": 0,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Airtable payment record: ${id}`);
        } catch (error) {
            console.error("Error updating Airtable Payment record:", error.message);
        }

        // Update class availability in Biaw Classes
        if (memberId) {
            try {
                const classRecords = await axios.get(`${biawClassesUrl}?filterByFormula={Field ID}='${memberId}'`, {
                    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                });

                if (classRecords.data.records.length > 0) {
                    const classRecord = classRecords.data.records[0];
                    const updatedRemainingSeats = (parseInt(classRecord.fields["Number of seats remaining"], 10) || 0) + seatsPurchased;
                    const updatedTotalSeats = (parseInt(classRecord.fields["Total Number of Purchased Seats"], 10) || 0) - seatsPurchased;

                    await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                        fields: {
                            "Number of seats remaining": updatedRemainingSeats.toString(),
                            "Total Number of Purchased Seats": updatedTotalSeats.toString(),
                        },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Biaw Classes record: ${classRecord.id}`);
                }
            } catch (error) {
                console.error("Error updating Biaw Classes record:", error.message);
            }
        }

        // Update linked multiple class registrations
        const multipleClassRegistrationIds = fields["Multiple Class Registration"] || [];
        for (const multipleClassIdObj of multipleClassRegistrationIds) {
            const multipleClassId = multipleClassIdObj.id || multipleClassIdObj; // Access the 'id' property if it's an object, or use the value directly

            if (multipleClassId) {
                try {
                    await axios.patch(`${multipleClassRegistrationUrl}/${multipleClassId}`, {
                        fields: { "Payment Status": "ROII-Cancelled" },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
                } catch (error) {
                    console.error(`Error updating Multiple Class Registration ID: ${multipleClassId}:`, error.message);
                }
            }
        }

        // Send confirmation email
        if (custEmail) {
            try {
                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                    to: custEmail,
                    subject: `Class Cancellation Processed Successfully for ${classname}`,
                    html: `
  <p>Dear ${uername},</p>

  <p>We hope this email finds you well.</p>

  <p>We would like to inform you that your cancellation request for the class <strong>${classname}</strong> and ${seatsPurchased} seat(s) has been successfully processed.</p>

  <p>The confirmation status for your class has been updated.</p>

  <p>If you have any questions or need further assistance, please do not hesitate to contact our support team.</p>

  <p>Best regards,<br>
  <strong>BIAW Support</strong></p>
`

                });                

                console.log(`Email sent to ${custEmail} for refund request ID: ${id}`);
            } catch (error) {
                console.error(`Error sending refund email to ${custEmail}:`, error.message);
            }
        }

        return res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        console.error("Error handling refund:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

//refund without cancelation
app.post("/api/without", async (req, res) => {
    try {
        const { id, fields } = req.body;

        if (!id || !fields) {
            return res.status(400).json({ message: "Invalid request data" });
        }

        console.log("Received refund request:", { id, fields });

        const memberId1 = fields["Field ID (from Biaw Classes)"]?.[0] || null;
        const seatsPurchased = parseInt(fields["Number of seat Purchased"], 10) || 0;
        const custEmail1 = fields["Email"];
        const uername = fields["Name"];
        const classname = fields["Name (from Biaw Classes)"]?.[0] || null

        // Update Airtable - Refund Confirmation and Payment Status
        try {
            await axios.patch(`${airtableUrl}/${id}`, {
                fields: {
                    "Refund Confirmation": "Confirmed",
                    "Payment Status": "Cancelled Without Refund",
                    "Number of seat Purchased": 0,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Airtable payment record: ${id}`);
        } catch (error) {
            console.error("Error updating Airtable Payment record:", error.message);
        }

        // Update class availability in Biaw Classes
        if (memberId1) {
            try {
                const classRecords = await axios.get(`${biawClassesUrl}?filterByFormula={Field ID}='${memberId1}'`, {
                    headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                });

                if (classRecords.data.records.length > 0) {
                    const classRecord = classRecords.data.records[0];
                    const updatedRemainingSeats = (parseInt(classRecord.fields["Number of seats remaining"], 10) || 0) + seatsPurchased;
                    const updatedTotalSeats = (parseInt(classRecord.fields["Total Number of Purchased Seats"], 10) || 0) - seatsPurchased;

                    await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                        fields: {
                            "Number of seats remaining": updatedRemainingSeats.toString(),
                            "Total Number of Purchased Seats": updatedTotalSeats.toString(),
                        },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Biaw Classes record: ${classRecord.id}`);
                }
            } catch (error) {
                console.error("Error updating Biaw Classes record:", error.message);
            }
        }

        // Update linked multiple class registrations
        const multipleClassRegistrationIds = fields["Multiple Class Registration"] || [];
        for (const multipleClassIdObj of multipleClassRegistrationIds) {
            const multipleClassId = multipleClassIdObj.id || multipleClassIdObj; // Access the 'id' property if it's an object, or use the value directly

            if (multipleClassId) {
                try {
                    await axios.patch(`${multipleClassRegistrationUrl}/${multipleClassId}`, {
                        fields: { "Payment Status": "Cancelled Without Refund" },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
                } catch (error) {
                    console.error(`Error updating Multiple Class Registration ID: ${multipleClassId}:`, error.message);
                }
            }
        }

        // Send confirmation email
        if (custEmail1) {
            try {
                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                    to: custEmail1,
                    subject: `Class Cancellation Processed Successfully for ${classname}`,
                    text: `Dear ${uername},
                
We hope this email finds you well.
                
We would like to inform you that your cancel request for class ${classname} and ${seatsPurchased} seat(s) has been successfully processed. 
The confirmation status for your class has been updated
                
If you have any questions or need further assistance, please do not hesitate to contact our support team.
                
Best regards,  
BIAW Support`
                });   

                console.log(`Email sent to ${custEmail1} for refund request ID: ${id}`);
            } catch (error) {
                console.error(`Error sending refund email to ${custEmail1}:`, error.message);
            }
        }

        return res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        console.error("Error handling refund:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});


const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Function to process and update rows
async function processRows() {
  try {
    // Fetch records where "Publish / Unpublish" field is "Update"
    const records = await base(AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: `{Seat addition status} = "Updated"`, 
      })
      .all();

    for (const record of records) {
      const fields = record.fields;
      const recordId = record.id;

      // Parse relevant fields as numbers
      const currentSeats = parseInt(fields['Number of seats'] || 0, 10);
      const currentRemaining = parseInt(fields['Number of seats remaining'] || 0, 10);
      const additionalSeat = parseInt(fields['Additional seat'] || "0", 10);
      const reduceSeat = parseInt(fields['Reduce Seat'] || "0", 10);

      // Check if there are additional or reduced seats to process
      if (additionalSeat > 0 || reduceSeat > 0) {
        console.log(`Processing record: ${recordId}`);

        // Calculate new seat values
        const newTotalSeats = Math.max(currentSeats + additionalSeat - reduceSeat, 0); // Ensure non-negative
        const newRemainingSeats = Math.max(currentRemaining + additionalSeat - reduceSeat, 0); // Ensure non-negative

        console.log(`New calculated values - Total Seats: ${newTotalSeats}, Remaining Seats: ${newRemainingSeats}`);

        // Update the record in Airtable
        try {
          await base(AIRTABLE_TABLE_NAME).update(recordId, {
            'Number of seats': Number(newTotalSeats), // Ensure it's a number
            'Number of seats remaining': String(newRemainingSeats), // Convert number to string
            'Additional seat': "0", // Reset to default
            'Reduce Seat': "0", // Reset to default
            'Seat addition status': "Publish" // Mark as updated
          });

          console.log(`Record updated successfully: ${recordId}`);
        } catch (updateError) {
          console.error(`Failed to update record ${recordId}:`, updateError.message);
        }
      }
    }
  } catch (error) {
    console.error('Error processing rows:', error.message);
  }
}

// Run the function at regular intervals
setInterval(() => {
  console.log('Checking for updates...');
  processRows();
}, 30000); // Runs every 10 seconds


async function processPayments() {
    try {
        console.log("Fetching records from Airtable...");

        // Setup NodeMailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail', // or another email service (e.g., Yahoo, Outlook)
            auth: {
                user: process.env.EMAIL_USER, // Your email
                pass: process.env.EMAIL_PASSWORD, // Your email password or app password
            },
        });

        // Fetch records with filtering
        const records = await base(AIRTABLE_TABLE_NAME3)
            .select({
                filterByFormula: `AND(
                    {Booking Type} = "Admin booked",
                    {Payment Status} = "Paid",
                    {Member ID (from User ID)} != "",
                    {Biaw Classes} != "",
                    {Email} != "",
                    NOT({Field ID (from Biaw Classes)} = ""),
                    OR(
                        {Admin class booking} = "",
                        {Admin class booking} = "Rejected"
                    )
                )`
            })
            .all();
                    // {Self Purchase} = "",

        if (records.length === 0) {
            console.log("No records found matching the filter.");
            return;
        }

        console.log(`Found ${records.length} records matching the filter.`);

        for (const record of records) {
            console.log(`Processing record: ${record.id}`);

            const email = record.get('Email');
            const seatsPurchased = parseInt(record.get('Number of seat Purchased'), 10) || 0;
            const classId1 = record.get('Biaw Classes');
            const multipleClassRegistrationIds = record.get('Multiple Class Registration') || [];
            const amount = record.get('Amount Total');
            const name = record.get("Name");
            const description = record.get("Description")?.[0] || "No details provided";
            const classname = record.get("Name (from Biaw Classes)")?.[0] || "No details provided";
            const location = record.get("Location (from Biaw Classes)")?.[0] || "No location provided";
            const currentBookingStatus = record.get("Admin class booking");

            if (!email || seatsPurchased <= 0 || !classId1) {
                console.log(
                    `Skipping record due to missing or invalid data. Record ID: ${record.id}`,
                    { email, seatsPurchased, classId1 }
                );
                continue;
            }

            try {
                // Fetch linked class details
                const linkedClass = await base(AIRTABLE_TABLE_NAME).find(classId1);

                if (!linkedClass) {
                    console.log(`Skipping record: Linked class not found for ${record.id}`);
                    continue;
                }

                const seatsRemaining1 = parseInt(linkedClass.get('Number of seats remaining'), 10) || 0;
                const publishStatus1 = linkedClass.get('Publish / Unpublish');

                // Check if there are remaining seats, the class is marked as Deleted, or purchased seats exceed remaining seats
                if (seatsRemaining1 <= 0 || publishStatus1 === "Deleted" || seatsPurchased > seatsRemaining1) {
                    console.log(
                        `Skipping record: Either no seats remaining, class is marked as Deleted, or purchased seats exceed available seats. Record ID: ${record.id}`
                    );

                    // Check if already marked as "Rejected"
                    if (currentBookingStatus !== "Rejected") {
                        // Update "Admin class booking" to "Rejected"
                        await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                            "Admin class booking": "Rejected"
                        });

                        const rejectionSubject = 'Booking Rejected';
                        const rejectionBody = `
Dear ${name},

We regret to inform you that your booking for the class could not be processed due to either unavailability of seats, the cancellation of the class, or the requested seats exceeding the available seats.

We sincerely apologize for any inconvenience this may have caused and appreciate your understanding. Please feel free to contact our support team if you have any questions or require further assistance.

Thank you for your patience and support.

Kind regards,
BIAW Support
                        `;

                        await transporter.sendMail({
                            from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                            to: email,
                            subject: rejectionSubject,
                            text: rejectionBody,
                        });

                        console.log(`Rejection email sent to ${email}.`);
                    } else {
                        console.log(`Skipping email for already rejected record: ${record.id}`);
                    }
                    continue;
                }

                // Update Airtable record with Payment Status as "Paid"
                await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                    'Payment Status': 'Paid',
                    'ROII member': 'No',
                    "Self Purchase": "false",
                    "Admin class booking": "Completed"
                });

                console.log(`Updated Airtable record ${record.id} with Payment Status 'Paid'.`);

                // Fetch class record and update seats
                const classRecord1 = await base(AIRTABLE_TABLE_NAME).find(classId1);

                if (classRecord1) {
                    const currentRemainingSeats1 = parseInt(classRecord1.fields['Number of seats remaining'], 10) || 0;
                    const currentTotalPurchasedSeats1 = parseInt(classRecord1.fields['Total Number of Purchased Seats'], 10) || 0;

                    const updatedRemainingSeats1 = (currentRemainingSeats1 - seatsPurchased).toString();
                    const updatedTotalSeats1 = (currentTotalPurchasedSeats1 + seatsPurchased).toString();

                    console.log('Updating Biaw Classes:', {
                        'Number of seats remaining': updatedRemainingSeats1,
                        'Total Number of Purchased Seats': updatedTotalSeats1,
                    });

                    await axios.patch(`${biawClassesUrl}/${classRecord1.id}`, {
                        fields: {
                            'Number of seats remaining': updatedRemainingSeats1,
                            'Total Number of Purchased Seats': updatedTotalSeats1,
                        },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Biaw Classes record: ${classRecord1.id}`);
                }

                // Update Multiple Class Registration
                for (const multipleClassId of multipleClassRegistrationIds) {
                    try {
                        console.log(`Updating record ID ${multipleClassId} in Multiple Class Registration table.`);
                        await base(AIRTABLE_TABLE_NAME2).update(multipleClassId, {
                            'Payment Status': 'Paid',
                        });
                        console.log(`Payment Status updated to "Paid" for record ID ${multipleClassId}.`);
                    } catch (error) {
                        console.error(`Failed to update record ID ${multipleClassId}:`, error.message);
                    }
                }

                // Send email confirmation
                const emailSubject = `Class Registration Confirmation for ${classname}`;
                const emailBody = `
Dear ${name},

You have successfully registered for the class. Here are the details:

Your registration for the ${classname} has been confirmed. Below are your details:

Description: ${description}

   - Number of Seats Purchased: ${seatsPurchased}
   - Total Amount Paid: ${amount}
   - Location: ${location}

We look forward to seeing you at the class. Should you have any questions or need further assistance, please don’t hesitate to contact us.

Best regards,
BIAW Support
                `;

                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: emailSubject,
                    text: emailBody,
                });

                console.log(`Confirmation email sent to ${email}.`);
            } catch (error) {
                console.error(
                    `Failed to update Airtable, adjust class seats, update multiple class registration, or send email. Error: ${error.message}`
                );
            }
        }
    } catch (error) {
        console.error(
            `Error fetching records or processing payments: ${error.message}`
        );
    }
}

processPayments();




async function runPeriodically266(intervalMs) {
    console.log("Starting paid periodic sync...");
    setInterval(async () => {
        console.log(`Running sync at ${new Date().toISOString()}`);
        await processPayments(); 
    }, intervalMs);
}

// Start periodic execution every 30 seconds (30 * 1000 milliseconds)
runPeriodically266(30 * 1000);

async function processPayments1() {
    try {
        console.log("Fetching records from Airtable...");

        // Setup NodeMailer transporter
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASSWORD,
            },
        });

        // Fetch records with filtering
        const records = await base(AIRTABLE_TABLE_NAME3)
            .select({
                filterByFormula: `AND(
                    {Booking Type} = "Admin booked",
                    {Payment Status} = "ROII-Free",
                    {Self Purchase} = "",
                    {Member ID (from User ID)} != "",
                    {Biaw Classes} != "",
                    {Email} != "",
                    NOT({Field ID (from Biaw Classes)} = "")
                )`,
            })
            .all();

        if (records.length === 0) {
            console.log("No records found matching the filter.");
            return;
        }

        console.log(`Found ${records.length} records matching the filter.`);

        for (const record of records) {
            console.log(`Processing record: ${record.id}`);

            const email = record.get('Email');
            const seatsPurchased = parseInt(record.get('Number of seat Purchased'), 10) || 0;
            const classId1 = record.get('Biaw Classes');
            const multipleClassRegistrationIds = record.get('Multiple Class Registration') || [];
            const name = record.get("Name");
            const description = record.get("Description")?.[0] || "No details provided";
            const classname = record.get("Name (from Biaw Classes)")?.[0] || "No details provided";
            const location = record.get("Location (from Biaw Classes)")?.[0] || "No location provided";
            const currentBookingStatus = record.get("Admin class booking");

            if (!email || seatsPurchased <= 0 || !classId1) {
                console.log(
                    `Skipping record due to missing or invalid data. Record ID: ${record.id}`,
                    { email, seatsPurchased, classId1 }
                );
                continue;
            }

            try {
                // Fetch linked class details
                const linkedClass = await base(AIRTABLE_TABLE_NAME).find(classId1);

                if (!linkedClass) {
                    console.log(`Skipping record: Linked class not found for ${record.id}`);
                    continue;
                }

                const seatsRemaining2 = linkedClass.get('Number of seats remaining');
                const publishStatus2 = linkedClass.get('Publish / Unpublish');

                // Handle rejection cases
                if (seatsRemaining2 <= 0 || publishStatus2 === "Deleted" || seatsPurchased > seatsRemaining2) {
                    if (currentBookingStatus !== "Rejected") {
                        console.log(
                            `Marking record as Rejected due to no seats or class deletion. Record ID: ${record.id}`
                        );

                        // Update "Admin class booking" to "Rejected"
                        await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                            "Admin class booking": "Rejected",
                        });

                        // Send rejection email
                        const rejectionSubject = 'Booking Rejected';
                        const rejectionBody = `
Dear ${name},

We regret to inform you that your booking for the class could not be processed due to either unavailability of seats or the cancellation of the class.

We sincerely apologize for any inconvenience this may have caused and appreciate your understanding. Please feel free to contact our support team if you have any questions or require further assistance.

Thank you for your patience and support.

Kind regards,
BIAW Support
                        `;

                        await transporter.sendMail({
                            from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                            to: email,
                            subject: rejectionSubject,
                            text: rejectionBody,
                        });

                        console.log(`Rejection email sent to ${email}.`);
                    } else {
                        console.log(`Skipping email for already rejected record: ${record.id}`);
                    }
                    continue;
                }

                // Update Airtable record with Payment Status as "Paid"
                await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                    'Payment Status': 'ROII-Free',
                    'ROII member': 'Yes',
                    "Self Purchase": "false",
                    "Admin class booking": "Completed",
                });

                console.log(`Updated Airtable record ${record.id} with Payment Status 'Paid'.`);

                // Fetch class record and update seats
                const classRecord = await base(AIRTABLE_TABLE_NAME).find(classId1);

                if (classRecord) {
                    const currentRemainingSeats2 = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
                    const currentTotalPurchasedSeats2 = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

                    const updatedRemainingSeats2 = (currentRemainingSeats2 - seatsPurchased).toString();
                    const updatedTotalSeats2 = (currentTotalPurchasedSeats2 + seatsPurchased).toString();

                    console.log('Updating Biaw Classes:', {
                        'Number of seats remaining': updatedRemainingSeats2,
                        'Total Number of Purchased Seats': updatedTotalSeats2,
                    });

                    await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                        fields: {
                            'Number of seats remaining': updatedRemainingSeats2,
                            'Total Number of Purchased Seats': updatedTotalSeats2,
                        },
                    }, {
                        headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
                    });

                    console.log(`Updated Biaw Classes record: ${classRecord.id}`);
                }

                // Update Multiple Class Registration
                for (const multipleClassId of multipleClassRegistrationIds) {
                    try {
                        console.log(`Updating record ID ${multipleClassId} in Multiple Class Registration table.`);
                        await base(AIRTABLE_TABLE_NAME2).update(multipleClassId, {
                            'Payment Status': 'ROII Free',
                        });
                        console.log(`Payment Status updated to "Paid" for record ID ${multipleClassId}.`);
                    } catch (error) {
                        console.error(`Failed to update record ID ${multipleClassId}:`, error.message);
                    }
                }

                // Send confirmation email
                const confirmationSubject = `Class Registration Confirmation for ${classname}`;
                const confirmationBody = `
Dear ${name},

You have successfully registered for the class. Here are the details:

Your registration for the ${classname} has been confirmed. Below are your details:

Description: ${description}

    - Number of Seats Purchased: ${seatsPurchased}
    - Location: ${location}

We look forward to seeing you at the class. Should you have any questions or need further assistance, please don’t hesitate to contact us.

Best regards,
BIAW Support
                `;

                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                    to: email,
                    subject: confirmationSubject,
                    text: confirmationBody,
                });

                console.log(`Confirmation email sent to ${email}.`);
            } catch (error) {
                console.error(
                    `Failed to update Airtable, adjust class seats, update multiple class registration, or send email. Error: ${error.message}`
                );
            }
        }
    } catch (error) {
        console.error(`Error fetching records or processing payments: ${error.message}`);
    }
}


async function runPeriodically22(intervalMs) {
    console.log("Starting Roii periodic sync...");
    setInterval(async () => {
        console.log(`Running sync at ${new Date().toISOString()}`);
        await processPayments1();  // Your existing processPayments1 logic
    }, intervalMs);
}

// Start periodic execution every 30 seconds (30 * 1000 milliseconds)
runPeriodically22(30 * 1000);

const stripe2 = require('stripe')(process.env.STRIPE_API_KEY);

// Function to get the product ID from a price ID
async function getProductFromPrice(priceId) {
  try {
    const price = await stripe2.prices.retrieve(priceId);
    return price.product; // Returns the product ID associated with the price
  } catch (error) {
    console.error(`Error fetching product for price ID ${priceId}:`, error);
    throw error;
  }
}

// Main function
async function createCoupons() {
    try {
      // Fetch records from Airtable
      const records = await base(AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: `AND({% Discounts} > 0, {Coupon Code} = "", {Member Price ID} != "", {Non-Member Price ID} != "", {Publish / Unpublish} = "Update")`
      })
      .all();
    
      // Process each record
      for (const record of records) {
        const discountPercentage = record.get('% Discounts');
        const memberPriceId = record.get('Member Price ID');
        const nonMemberPriceId = record.get('Non-Member Price ID');
        const maxDiscountedSeats = record.get('Maximum discounted seats');
  
        if (discountPercentage && memberPriceId && nonMemberPriceId) {
          // Fetch the product IDs for the given price IDs
          const memberProductId = await getProductFromPrice(memberPriceId);
          const nonMemberProductId = await getProductFromPrice(nonMemberPriceId);
  
          // Create a Stripe coupon
          const discountCoupon = await stripe2.coupons.create({
            percent_off: discountPercentage,
            duration: 'once',
            name: `${discountPercentage}% Discount for`,
            applies_to: {
              products: [memberProductId, nonMemberProductId], // Apply to both products
            },
            // Set max_redemptions if there are discounted seats
            max_redemptions: maxDiscountedSeats > 0 ? maxDiscountedSeats : undefined,
          });
  
          console.log('Coupon created successfully:', discountCoupon);
  
          // Generate a random promotion code
          const generatedCode = generateRandomCode(8);
  
          // Create a Stripe promotion code
          const promotionCode = await stripe2.promotionCodes.create({
            coupon: discountCoupon.id,
            code: generatedCode,
          });
  
          console.log('Promotion code created successfully:', promotionCode);
  
          // Update Airtable with the promotion code
          await base(AIRTABLE_TABLE_NAME).update(record.id, {
            'Coupon Code': generatedCode,
            "Publish / Unpublish":"Updated"
          });
  
          console.log(`Record updated successfully for ID: ${record.id}`);
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }
  

// Helper function to generate random codes
function generateRandomCode(length) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Run the main function
createCoupons();

async function runPeriodically34(intervalMs) {
    console.log("Starting periodic sync...");
    setInterval(async () => {
        console.log(`Running sync at ${new Date().toISOString()}`);
        await createCoupons();  // Your existing processPayments1 logic
    }, intervalMs);
}

// Start periodic execution every 30 seconds (30 * 1000 milliseconds)
runPeriodically34(40 * 1000);



const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
