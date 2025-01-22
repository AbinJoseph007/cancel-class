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


// Function to fetch records from Airtable
async function getRefundRequests() {
    try {
        const response = await axios.get(airtableUrl, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        const records = response.data.records.filter(record => {
            const paymentStatus = record.fields['Payment Status'];
            const refundConfirmation = record.fields['Refund Confirmation'];
            const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;

            return (
                paymentStatus === 'Refunded' &&
                refundConfirmation === 'Confirmed' &&
                seatsPurchased > 0 // Exclude records with seatsPurchased = 0
            );
        });

        return records;
    } catch (error) {
        console.error(`Error fetching Airtable records: ${error.response?.data || error.message}`);
        return [];
    }
}

// Function to update Airtable record
async function updateAirtableRecord(recordId, fields) {
    try {
        console.log(`Updating record: ${recordId} with fields:`, fields);
        const response = await axios.patch(`${airtableUrl}/${recordId}`, {
            fields,
        }, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        console.log(`Updated Airtable record: ${recordId}`);
    } catch (error) {
        console.error(`Error updating Airtable: ${JSON.stringify(error.response?.data || error.message)}`);
    }
}

// Function to fetch the class record from the "Biaw Classes" table
async function getClassRecord(classFieldValue) {
    try {
        const classRecords = await airtableBase("Biaw Classes")
            .select({
                filterByFormula: `{Field ID} = '${classFieldValue}'`,
                maxRecords: 1,
            })
            .firstPage();

        if (classRecords.length === 0) {
            console.log(`Class record not found in Biaw Classes table for ID: ${classFieldValue}.`);
            return null;
        }

        console.log(`Class record found for ID: ${classFieldValue}.`);
        return classRecords[0];
    } catch (error) {
        console.error(`Error fetching class record: ${error.message}`);
        console.log(classFieldValue);

        return null;
    }
}


// Function to update Biaw Classes table dynamically based on seats
async function updateBiawClasses(seatsPurchased, classFieldValue) {
  try {
      const classRecord = await getClassRecord(classFieldValue);

      if (classRecord) {
          const currentRemainingSeats = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
          const currentTotalPurchasedSeats = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

          const updatedRemainingSeats = (currentRemainingSeats + seatsPurchased).toString();
          const updatedTotalSeats = (currentTotalPurchasedSeats - seatsPurchased).toString();

          console.log('Updating Biaw Classes:', {
              'Number of seats remaining': updatedRemainingSeats,
              'Total Number of Purchased Seats': updatedTotalSeats,
          });

          await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
              fields: {
                  'Number of seats remaining': updatedRemainingSeats,
                  'Total Number of Purchased Seats': updatedTotalSeats,
              },
          }, {
              headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
          });

          console.log(`Updated Biaw Classes record: ${classRecord.id}`);
      }
  } catch (error) {
      console.error(`Error updating Biaw Classes: ${JSON.stringify(error.response?.data || error.message)}`);
  }
}

// Function to process a refund via Stripe
async function processRefund(paymentIntentId) {
    try {
        const refund = await stripe.refunds.create({
            payment_intent: paymentIntentId,
        });
        console.log(`Refund successful for Payment Intent: ${paymentIntentId}`);
        return refund;
    } catch (error) {
        return null;
    }
}


async function updateMultipleClassRegistrationPaymentStatus(recordId, newPaymentStatus) {
    try {
        const recordResponse = await axios.get(`${airtableUrl}/${recordId}`, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
        });
  
        const multipleClassRegistrationIds = recordResponse.data.fields["Multiple Class Registration"] || [];
  
        for (const multipleClassId of multipleClassRegistrationIds) {
            const multipleClassUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}/${multipleClassId}`;
  
            await axios.patch(
                multipleClassUrl,
                {
                    fields: {
                        "Payment Status": newPaymentStatus,
                    },
                },
                { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
            );
  
            console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
        }
    } catch (error) {
        console.error(`Error updating "Payment Status" for linked records: ${error.message}`);
    }
  }
// Main function to handle refunds
async function handleRefunds() {
    const refundRequests = await getRefundRequests();

    for (const record of refundRequests) {
        const paymentIntentId = record.fields['Payment ID'];
        const classFieldValue = record.fields['Airtable id'];
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
        const custEmail = record.fields['Email']

        // Skip if the record already reflects a refund
        if (
            record.fields['Refund Confirmation'] === 'Confirmed' &&
            record.fields['Payment Status'] === 'Refunded' &&
            seatsPurchased === 0
        ) {
            console.log(`Record ${record.id} already processed. Skipping.`);
            continue;
        }

        if (paymentIntentId) {
            const refund = await processRefund(paymentIntentId);

            if (refund && refund.status === 'succeeded') {
                await updateAirtableRecord(record.id, {
                    'Refund Confirmation': 'Confirmed',
                    'Payment Status': 'Refunded',
                    'Number of seat Purchased': 0,
                });

                await updateBiawClasses(seatsPurchased, classFieldValue);
                await updateMultipleClassRegistrationPaymentStatus(record.id, 'Refunded');
                if (custEmail) {
                    const subject = 'Refund Processed Successfully';
                    const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'ROII-Cancelled', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nYour Team`;
        
                    try {
                        await transporter.sendMail({
                            from: `"BIAW Support" <${process.env.EMAIL_USER}>`, // Sender's email address
                            to: custEmail, // Recipient's email address
                            subject, // Email subject
                            text, // Email body
                        });
        
                        console.log(`Email sent to ${custEmail} for refund request ID: ${record.id}`);
                    } catch (error) {
                        console.error(`Error sending email to ${custEmail}: ${error.message}`);
                    }
                } else {
                    console.log(`No email address found for refund request ID: ${record.id}`);
                }
            }
        } else {
            console.warn(`No Payment ID found for record: ${record.id}`);
        }
    }
}



//function  ROII cancelled


// Function to fetch records from Airtable
async function fetchRefundRequests() {
    try {
        const response = await axios.get(airtableUrl, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        const records = response.data.records.filter(record => {
            const paymentStatus = record.fields['Payment Status'];
            const refundConfirmation = record.fields['Refund Confirmation'];
            const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;

            return (
                paymentStatus === 'ROII-Cancelled' &&
                refundConfirmation === 'Confirmed' &&
                seatsPurchased > 0 // Exclude records with seatsPurchased = 0
            );
        });

        return records;
    } catch (error) {
        console.error(`Error fetching Airtable records: ${error.response?.data || error.message}`);
        return [];
    }
}

// Function to update Airtable record
async function modifyAirtableRecord(recordId, fields) {
    try {
        console.log(`Updating record: ${recordId} with fields:`, fields);
        const response = await axios.patch(`${airtableUrl}/${recordId}`, {
            fields,
        }, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        console.log(`Updated Airtable record: ${recordId}`);
    } catch (error) {
        console.error(`Error updating Airtable: ${JSON.stringify(error.response?.data || error.message)}`);
    }
}

// Function to fetch the class record from the "Biaw Classes" table
async function fetchClassRecord(classFieldValue) {
    try {
        const classRecords = await airtableBase("Biaw Classes")
            .select({
                filterByFormula: `{Field ID} = '${classFieldValue}'`,
                maxRecords: 1,
            })
            .firstPage();

        if (classRecords.length === 0) {
            console.log(`Class record not found in Biaw Classes table for ID: ${classFieldValue}.`);
            return null;
        }

        console.log(`Class record found for ID: ${classFieldValue}.`);
        return classRecords[0];
    } catch (error) {
        console.error(`Error fetching class record: ${error.message}`);
        console.log(classFieldValue);

        return null;
    }
}

// Function to update Biaw Classes table dynamically based on seats
async function adjustBiawClassSeats(seatsPurchased, classFieldValue) {
    try {
        const classRecord = await fetchClassRecord(classFieldValue);

        if (classRecord) {
            const currentRemainingSeats = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
            const currentTotalPurchasedSeats = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

            const updatedRemainingSeats = (currentRemainingSeats + seatsPurchased).toString();
            const updatedTotalSeats = (currentTotalPurchasedSeats - seatsPurchased).toString();

            console.log('Updating Biaw Classes:', {
                'Number of seats remaining': updatedRemainingSeats,
                'Total Number of Purchased Seats': updatedTotalSeats,
            });

            await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                fields: {
                    'Number of seats remaining': updatedRemainingSeats,
                    'Total Number of Purchased Seats': updatedTotalSeats,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Biaw Classes record: ${classRecord.id}`);
        }
    } catch (error) {
        console.error(`Error updating Biaw Classes: ${JSON.stringify(error.response?.data || error.message)}`);
    }
}


async function MultipleClassRegistrationPaymentStatus(recordId, newPaymentStatus) {
    try {
        const recordResponse = await axios.get(`${airtableUrl}/${recordId}`, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
        });
  
        const multipleClassRegistrationIds = recordResponse.data.fields["Multiple Class Registration"] || [];
  
        for (const multipleClassId of multipleClassRegistrationIds) {
            const multipleClassUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}/${multipleClassId}`;
  
            await axios.patch(
                multipleClassUrl,
                {
                    fields: {
                        "Payment Status": newPaymentStatus,
                    },
                },
                { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
            );
  
            console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
        }
    } catch (error) {
        console.error(`Error updating "Payment Status" for linked records: ${error.message}`);
    }
  }
// Main function to handle refunds with email notifications
async function processRefundRequests() {
    const refundRequests = await fetchRefundRequests();

    for (const record of refundRequests) {
        const classFieldValue = record.fields['Airtable id'];
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
        const customerEmail = record.fields['Email']; // Assume the email field exists in Airtable

        // Update refund confirmation and payment status
        await modifyAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'ROII-Cancelled',
            'Number of seat Purchased': 0,
        });

        // Adjust class seats and update related class registration payment statuses
        await adjustBiawClassSeats(seatsPurchased, classFieldValue);
        await MultipleClassRegistrationPaymentStatus(record.id, 'ROII-Cancelled');

        // Send email notification
        if (customerEmail) {
            const subject = 'Refund Processed Successfully';
            const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'ROII-Cancelled', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nYour Team`;

            try {
                await transporter.sendMail({
                    from: process.env.EMAIL_USER, // Sender's email address
                    to: customerEmail, // Recipient's email address
                    subject, // Email subject
                    text, // Email body
                });

                console.log(`Email sent to ${customerEmail} for refund request ID: ${record.id}`);
            } catch (error) {
                console.error(`Error sending email to ${customerEmail}: ${error.message}`);
            }
        } else {
            console.log(`No email address found for refund request ID: ${record.id}`);
        }
    }
}


//function no refund

async function getNonRefundedCancellations() {
    try {
        const response = await axios.get(airtableUrl, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        const records = response.data.records.filter(record => {
            const paymentStatus = record.fields['Payment Status'];
            const refundConfirmation = record.fields['Refund Confirmation'];
            const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;

            return (
                paymentStatus === 'Cancelled Without Refund' &&
                refundConfirmation === 'Confirmed' &&
                seatsPurchased > 0 // Exclude records with seatsPurchased = 0
            );
        });

        return records;
    } catch (error) {
        console.error(`Error fetching Airtable records: ${error.response?.data || error.message}`);
        return [];
    }
}


async function amendAirtableRecord(recordId, updatedFields) {
    try {
        console.log(`Updating record: ${recordId} with fields:`, updatedFields);
        const response = await axios.patch(`${airtableUrl}/${recordId}`, {
            fields: updatedFields,
        }, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        console.log(`Updated Airtable record: ${recordId}`);
    } catch (error) {
        console.error(`Error updating Airtable: ${JSON.stringify(error.response?.data || error.message)}`);
    }
}

async function getClassDetails(classId) {
    try {
        const classRecords = await airtableBase("Biaw Classes")
            .select({
                filterByFormula: `{Field ID} = '${classId}'`,
                maxRecords: 1,
            })
            .firstPage();

        if (classRecords.length === 0) {
            console.log(`Class record not found in Biaw Classes table for ID: ${classId}.`);
            return null;
        }

        console.log(`Class record found for ID: ${classId}.`);
        return classRecords[0];
    } catch (error) {
        console.error(`Error fetching class record: ${error.message}`);
        console.log(classId);

        return null;
    }
}

async function updateSeatsInClass(seatsToAdjust, classId) {
    try {
        const classRecord = await getClassDetails(classId);

        if (classRecord) {
            const currentRemainingSeats = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
            const currentTotalPurchasedSeats = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

            const updatedRemainingSeats = (currentRemainingSeats + seatsToAdjust).toString();
            const updatedTotalSeats = (currentTotalPurchasedSeats - seatsToAdjust).toString();

            console.log('Updating Biaw Classes:', {
                'Number of seats remaining': updatedRemainingSeats,
                'Total Number of Purchased Seats': updatedTotalSeats,
            });

            await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                fields: {
                    'Number of seats remaining': updatedRemainingSeats,
                    'Total Number of Purchased Seats': updatedTotalSeats,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Biaw Classes record: ${classRecord.id}`);
        }
    } catch (error) {
        console.error(`Error updating Biaw Classes: ${JSON.stringify(error.response?.data || error.message)}`);
    }
}


async function updateClassStatuses(recordId, newStatus) {
    try {
        const recordResponse = await axios.get(`${airtableUrl}/${recordId}`, {
            headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
        });
  
        const linkedClassIds = recordResponse.data.fields["Multiple Class Registration"] || [];
  
        for (const classId of linkedClassIds) {
            const classUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}/${classId}`;
  
            await axios.patch(
                classUrl,
                {
                    fields: {
                        "Payment Status": newStatus,
                    },
                },
                { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
            );
  
            console.log(`Updated Payment Status for Multiple Class Registration ID: ${classId}`);
        }
    } catch (error) {
        console.error(`Error updating "Payment Status" for linked records: ${error.message}`);
    }
}

async function handleRefundProcessing() {
    const refundRequests = await getNonRefundedCancellations();

    for (const record of refundRequests) {
        const classFieldValue = record.fields['Airtable id'];
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
        const custEmail2 = record.fields['Email']

        await amendAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'Cancelled Without Refund',
            'Number of seat Purchased': 0,
        });

        await updateSeatsInClass(seatsPurchased, classFieldValue);
        await updateClassStatuses(record.id, 'Cancelled Without Refund');
        if (custEmail2) {
            const subject = 'Refund Processed Successfully';
            const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'ROII-Cancelled', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nYour Team`;

            try {
                await transporter.sendMail({
                    from: `"BIAW Support" <${process.env.EMAIL_USER}>`, // Sender's email address
                    to: custEmail2, // Recipient's email address
                    subject, // Email subject
                    text, // Email body
                });

                console.log(`Email sent to ${custEmail2} for refund request ID: ${record.id}`);
            } catch (error) {
                console.error(`Error sending email to ${custEmail2}: ${error.message}`);
            }
        } else {
            console.log(`No email address found for refund request ID: ${record.id}`);
        }
    }
}


const tasks = [
    { name: "processRefundRequests", task: processRefundRequests },
    { name: "handleROIIProcessing", task: handleRefundProcessing },
    { name: "handleRefunds", task: handleRefunds },
];

async function runScheduler(tasks, intervalMs) {
    console.log("Starting unified task scheduler...");
    setInterval(async () => {
        for (const { name, task } of tasks) {
            console.log(`Running task: ${name} at ${new Date().toISOString()}`);
            try {
                await task();
            } catch (error) {
                console.error(`Error in task ${name}:`, error.message || error);
            }
        }
    }, intervalMs);
}

runScheduler(tasks, 30000);



const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Function to process and update rows
async function processRows() {
  try {
    // Fetch records where "Publish / Unpublish" field is "Update"
    const records = await base(AIRTABLE_TABLE_NAME)
      .select({
        filterByFormula: `{Publish / Unpublish} = "Update"`, // Filter condition
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
            'Publish / Unpublish': "Updated" // Mark as updated
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


  async function processPayments1() {
    try {
        console.log("Fetching records from Airtable...");
  
        // Fetch records with filtering
        const records = await base(AIRTABLE_TABLE_NAME3)
          .select({
            filterByFormula: `AND(
                {Booking Type} = "Admin booked",
                {Payment Status} = "ROII-Free",
                {Self Purchase} = "",
                {Client ID} != "",
                {Biaw Classes} != "",
                {Email} != "",
                NOT({Airtable id} = "")
            )`                                
          })
          .all();
  
        if (records.length === 0) {
            console.log("No records found matching the filter.");
            return;
        }
  
        console.log(`Found ${records.length} records matching the filter.`);
  
        for (const record of records) {
            console.log(`Processing record: ${record.id}`);
  
            // Extract and validate necessary fields
            const email = record.get('Email');
            const seatsPurchased = parseInt(record.get('Number of seat Purchased'), 10) || 0; // Extracted field
            const classId1 = record.get('Biaw Classes'); // Assuming a field linking to the class

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

                // Check if there are remaining seats and if the class is published
                if (seatsRemaining2 <= 0) {
                    console.log(
                        `Skipping record: No seats remaining for linked class ${classId1}. Record ID: ${record.id}`
                    );
                    continue;
                }

                if (publishStatus2 === "Deleted") {
                    console.log(
                        `Skipping record: Linked class is marked as Deleted. Record ID: ${record.id}`
                    );
                    continue;
                }

                // Update Airtable record with Payment Status as "Paid" (optional)
                await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                    'Payment Status': 'ROII-Free',
                    'ROII member': 'Yes',
                    "Self Purchase" : "false" // Optionally set this field to 'Paid' for tracking
                });
  
                console.log(`Updated Airtable record ${record.id} with Payment Status 'Paid'.`);

                // Fetch class record from Airtable
                const classRecord = await base(AIRTABLE_TABLE_NAME).find(classId1);

                if (classRecord) {
                    // Fetch the number of seats from the class record
                    const currentRemainingSeats2 = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
                    const currentTotalPurchasedSeats2 = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

                    // Calculate the updated values based on the purchased seats
                    const updatedRemainingSeats2 = (currentRemainingSeats2 - seatsPurchased).toString();
                    const updatedTotalSeats2 = (currentTotalPurchasedSeats2 + seatsPurchased).toString();

                    console.log('Updating Biaw Classes:', {
                        'Number of seats remaining': updatedRemainingSeats2,
                        'Total Number of Purchased Seats': updatedTotalSeats2,
                    });

                    // Update Airtable record with new values
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

            } catch (error) {
                console.error(
                    `Failed to update Airtable or adjust class seats. Error: ${error.message}`
                );
            }
        }
    } catch (error) {
        console.error(
            `Error fetching records or processing payments: ${error.message}`
        );
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
