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


// // Function to fetch records from Airtable
// async function getRefundRequests() {
//     try {
//         const response = await axios.get(airtableUrl, {
//             headers: {
//                 Authorization: `Bearer ${AIRTABLE_API_KEY}`,
//             },
//         });

//         const records = response.data.records.filter(record => {
//             const paymentStatus = record.fields['Payment Status'];
//             const refundConfirmation = record.fields['Refund Confirmation'];
//             const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;

//             return (
//                 paymentStatus === 'Refunded' &&
//                 refundConfirmation === 'Confirmed' &&
//                 seatsPurchased > 0
//             );
//         });

//         return records;
//     } catch (error) {
//         console.error(`Error fetching Airtable records: ${error.response?.data || error.message}`);
//         return [];
//     }
// }

// // Function to update Airtable record
// async function updateAirtableRecord(recordId, fields) {
//     try {
//         console.log(`Updating record: ${recordId} with fields:`, fields);
//         await axios.patch(`${airtableUrl}/${recordId}`, {
//             fields,
//         }, {
//             headers: {
//                 Authorization: `Bearer ${AIRTABLE_API_KEY}`,
//             },
//         });
//         console.log(`Updated Airtable record: ${recordId}`);
//     } catch (error) {
//         console.error(`Error updating Airtable: ${JSON.stringify(error.response?.data || error.message)}`);
//     }
// }

// // Function to fetch the class record from the "Biaw Classes" table
// async function getClassRecord(memberid) {
//     try {
//         const classRecords = await airtableBase("Biaw Classes")
//             .select({
//                 filterByFormula: `{Field ID} = '${memberid}'`,
//                 maxRecords: 1,
//             })
//             .firstPage();

//         if (classRecords.length === 0) {
//             console.log(`Class record not found in Biaw Classes table for ID: ${memberid}.`);
//             return null;
//         }

//         console.log(`Class record found for ID: ${memberid}.`);
//         return classRecords[0];
//     } catch (error) {
//         console.error(`Error fetching class record: ${error.message}`);
//         return null;
//     }
// }

// // Function to update Biaw Classes table dynamically based on seats
// async function updateBiawClasses(seatsPurchased, memberid) {
//     try {
//         const classRecord = await getClassRecord(memberid);

//         if (classRecord) {
//             const currentRemainingSeats = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
//             const currentTotalPurchasedSeats = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

//             const updatedRemainingSeats = (currentRemainingSeats + seatsPurchased).toString();
//             const updatedTotalSeats = (currentTotalPurchasedSeats - seatsPurchased).toString();

//             console.log('Updating Biaw Classes:', {
//                 'Number of seats remaining': updatedRemainingSeats,
//                 'Total Number of Purchased Seats': updatedTotalSeats,
//             });

//             await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
//                 fields: {
//                     'Number of seats remaining': updatedRemainingSeats,
//                     'Total Number of Purchased Seats': updatedTotalSeats,
//                 },
//             }, {
//                 headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
//             });

//             console.log(`Updated Biaw Classes record: ${classRecord.id}`);
//         }
//     } catch (error) {
//         console.error(`Error updating Biaw Classes: ${JSON.stringify(error.response?.data || error.message)}`);
//     }
// }

// // Function to process a refund via Stripe
// async function processRefund(paymentIntentId) {
//     try {
//         const refund = await stripe.refunds.create({
//             payment_intent: paymentIntentId,
//         });
//         console.log(`Refund successful for Payment Intent: ${paymentIntentId}`);
//         return refund;
//     } catch (error) {
//         console.error(`Error processing refund: ${error.message}`);
//         return null;
//     }
// }

// // Function to update linked records in Airtable
// async function updateMultipleClassRegistrationPaymentStatus(recordId, newPaymentStatus) {
//     try {
//         const recordResponse = await axios.get(`${airtableUrl}/${recordId}`, {
//             headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
//         });

//         const multipleClassRegistrationIds = recordResponse.data.fields["Multiple Class Registration"] || [];

//         for (const multipleClassId of multipleClassRegistrationIds) {
//             const multipleClassUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}/${multipleClassId}`;

//             await axios.patch(
//                 multipleClassUrl,
//                 {
//                     fields: {
//                         "Payment Status": newPaymentStatus,
//                     },
//                 },
//                 { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}`, "Content-Type": "application/json" } }
//             );

//             console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
//         }
//     } catch (error) {
//         console.error(`Error updating "Payment Status" for linked records: ${error.message}`);
//     }
// }

// // Main function to handle refunds
// async function handleRefunds() {
//     const refundRequests = await getRefundRequests();

//     for (const record of refundRequests) {
//         const paymentIntentId = record.fields['Payment ID'];
//         const memberid = record.fields["Field ID (from Biaw Classes)"]?.[0] || "No details provided";
//         const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
//         const custEmail = record.fields['Email'];

//         // Skip if the record already reflects a refund
//         if (
//             record.fields['Refund Confirmation'] === 'Confirmed' &&
//             record.fields['Payment Status'] === 'Refunded' &&
//             seatsPurchased === 0
//         ) {
//             console.log(`Record ${record.id} already processed. Skipping.`);
//             continue;
//         }

//         // Check if "Biaw Classes" data is available; skip if not
//         if (!memberid || memberid === "No details provided") {
//             console.log(`Skipping record ${record.id}. "Biaw Classes" data unavailable for member ID: ${memberid}`);
//             continue;
//         }

//         if (paymentIntentId) {
//             const refund = await processRefund(paymentIntentId);

//             if (refund && refund.status === 'succeeded') {
//                 await updateAirtableRecord(record.id, {
//                     'Refund Confirmation': 'Confirmed',
//                     'Payment Status': 'Refunded',
//                     'Number of seat Purchased': 0,
//                 });

//                 await updateBiawClasses(seatsPurchased, memberid);
//                 await updateMultipleClassRegistrationPaymentStatus(record.id, 'Refunded');
//             }
//         } else {
//             console.warn(`No Payment ID found for record: ${record.id}`);
//             await updateAirtableRecord(record.id, {
//                 'Refund Confirmation': 'Confirmed',
//                 'Payment Status': 'Refunded',
//                 'Number of seat Purchased': 0,
//             });
//             await updateBiawClasses(seatsPurchased, memberid);
//         }

//         if (custEmail) {
//             const subject = 'Refund Processed Successfully';
//             const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'Refunded', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nBIAW Support`;

//             try {
//                 await transporter.sendMail({
//                     from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
//                     to: custEmail,
//                     subject,
//                     text,
//                 });

//                 console.log(`Email sent to ${custEmail} for refund request ID: ${record.id}`);
//             } catch (error) {
//                 console.error(`Error sending email to ${custEmail}: ${error.message}`);
//             }
//         } else {
//             console.log(`No email address found for refund request ID: ${record.id}`);
//         }
//     }
// }


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

        let refundSuccessful = false;

        // Check if the payment ID is from Stripe
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

        // Update class availability in Biaw Classes
        if (memberId) {
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
        }

        // Update linked multiple class registrations
        const multipleClassRegistrationIds = fields["Multiple Class Registration"] || [];
        for (const multipleClassId of multipleClassRegistrationIds) {
            await axios.patch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE_NAME2}/${multipleClassId}`, {
                fields: { "Payment Status": "Refunded" },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Payment Status for Multiple Class Registration ID: ${multipleClassId}`);
        }

        // Send confirmation email
        if (custEmail) {
            await transporter.sendMail({
                from: `"BIAW Support" <${process.env.EMAIL_USER}>`,
                to: custEmail,
                subject: "Refund Processed Successfully",
                text: `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. 
                The payment status for your purchase has been updated to 'Refunded', and the refund has been confirmed.\n\n
                Thank you for your patience.\n\nBest regards,\nBIAW Support`,
            });

            console.log(`Email sent to ${custEmail} for refund request ID: ${id}`);
        }

        return res.status(200).json({ message: "Refund processed successfully" });
    } catch (error) {
        console.error("Error handling refund:", error.message);
        return res.status(500).json({ message: "Internal server error" });
    }
});

// app.post("/api/refund", (req, res) => {
//   const { id, fields } = req.body;

//   // Log or process the received data
//   console.log("Received data:", { id, fields });

//   // Send a response
//   res.status(200).json({ message: "Data received successfully" });
// });



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
async function fetchClassRecord(memberid1) {
    try {
        const classRecords = await airtableBase("Biaw Classes")
            .select({
                filterByFormula: `{Field ID} = '${memberid1}'`,
                maxRecords: 1,
            })
            .firstPage();

        if (classRecords.length === 0) {
            console.log(`Class record not found in Biaw Classes table for ID: ${memberid1}.`);
            return null;
        }

        console.log(`Class record found for ID: ${memberid1}.`);
        return classRecords[0];
    } catch (error) {
        console.error(`Error fetching class record: ${error.message}`);
        console.log(memberid1);

        return null;
    }
}

// Function to update Biaw Classes table dynamically based on seats
async function adjustBiawClassSeats(seatsPurchased, memberid1) {
    try {
        const classRecord = await fetchClassRecord(memberid1);

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
        // const classFieldValue = record.fields['Airtable id'];
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
        const memberid1 = record.fields["Field ID (from Biaw Classes)"]?.[0] || "No details provided"; //new feild

        const customerEmail = record.fields['Email']; // Assume the email field exists in Airtable

         // Check if "Biaw Classes" data is available; skip if not
         if (!memberid1 || memberid1 === "No details provided") {
            console.log(`Skipping record ${record.id}. "Biaw Classes" data unavailable for member ID: ${memberid1}`);
            continue;
        }
        // Update refund confirmation and payment status
        await modifyAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'ROII-Cancelled',
            'Number of seat Purchased': 0,
        });

        // Adjust class seats and update related class registration payment statuses
        await adjustBiawClassSeats(seatsPurchased, memberid1);
        await MultipleClassRegistrationPaymentStatus(record.id, 'ROII-Cancelled');

        // Send email notification
        if (customerEmail) {
            const subject = 'Class cancellation Successfully';
            const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'ROII-Cancelled', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nBIAW Support`;

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
        // const classFieldValue = record.fields['Airtable id'];
        const memberid2 = record.fields["Field ID (from Biaw Classes)"]?.[0] || "No details provided"; //new feild
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;
        const custEmail2 = record.fields['Email']

         // Check if "Biaw Classes" data is available; skip if not
         if (!memberid2 || memberid2 === "No details provided") {
            console.log(`Skipping record ${record.id}. "Biaw Classes" data unavailable for member ID: ${memberid2}`);
            continue;
        }

        await amendAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'Cancelled Without Refund',
            'Number of seat Purchased': 0,
        });

        await updateSeatsInClass(seatsPurchased, memberid2);
        await updateClassStatuses(record.id, 'Cancelled Without Refund');
        if (custEmail2) {
            const subject = 'Refund Processed Successfully';
            const text = `Dear Customer,\n\nYour refund request for ${seatsPurchased} seat(s) has been successfully processed. The payment status for your purchase has been updated to 'ROII-Cancelled', and the refund has been confirmed.\n\nThank you for your patience.\n\nBest regards,\nBIAW Support`;

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
    // { name: "handleRefunds", task: handleRefunds },
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


app.post("/api/cancelclass", (req, res) => {
  const { id, fields } = req.body;

  // Log or process the received data
  console.log("Received data:", { id, fields });

  // Send a response
  res.status(200).json({ message: "Data received successfully" });
});


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
