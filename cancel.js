const Airtable = require('airtable');
const express = require('express');
const cors = require("cors");
const axios = require('axios');
const { log } = require('console');
require('dotenv').config();

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

            return paymentStatus === 'Refunded' && refundConfirmation === 'Confirmed';
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
// Function to handle changes in "Payment Status"
async function handlePaymentStatusUpdates() {
  try {
      const response = await axios.get(airtableUrl, {
          headers: {
              Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          },
      });

      const records = response.data.records.filter(record => {
          const refundConfirmation = record.fields['Refund Confirmation'];
          const paymentStatus = record.fields['Payment Status'];

          if (refundConfirmation === 'Confirmed' || refundConfirmation === 'Cancellation Revoked') {
              return false;
          }

          return paymentStatus === 'Refunded';
      });

      for (const record of records) {
          await updateAirtableRecord(record.id, { 'Refund Confirmation': 'Cancellation Initiated' });
      }
  } catch (error) {
      console.error(`Error handling Payment Status updates: ${JSON.stringify(error.response?.data || error.message)}`);
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
            }
        } else {
            console.warn(`No Payment ID found for record: ${record.id}`);
        }
    }
}



async function runPeriodically(task, intervalMs) {
    console.log("Starting periodic task handleRefunds...");
    setInterval(async () => {
        console.log(`Running task at ${new Date().toISOString()}`);
        await task();
    }, intervalMs);
}

// Update the periodic calls
runPeriodically(handleRefunds, 50000);
runPeriodically(handlePaymentStatusUpdates, 50000);



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

            return paymentStatus === 'ROII-Cancelled' && refundConfirmation === 'Confirmed';
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

// Function to handle changes in "Payment Status"
async function processPaymentStatusChanges() {
    try {
        const response = await axios.get(airtableUrl, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        const records = response.data.records.filter(record => {
            const refundConfirmation = record.fields['Refund Confirmation'];
            const paymentStatus = record.fields['Payment Status'];

            if (refundConfirmation === 'Confirmed' || refundConfirmation === 'Cancellation Revoked') {
                return false;
            }

            return paymentStatus === 'ROII-Cancelled';
        });

        for (const record of records) {
            await modifyAirtableRecord(record.id, { 'Refund Confirmation': 'Cancellation Initiated' });
        }
    } catch (error) {
        console.error(`Error handling Payment Status updates: ${JSON.stringify(error.response?.data || error.message)}`);
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
// Main function to handle refunds
async function processRefundRequests() {
    const refundRequests = await fetchRefundRequests();

    for (const record of refundRequests) {
        const classFieldValue = record.fields['Airtable id'];
        const seatsPurchased = parseInt(record.fields['Number of seat Purchased'], 10) || 0;

        await modifyAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'ROII-Cancelled',
            'Number of seat Purchased': 0,
        });

        await adjustBiawClassSeats(seatsPurchased, classFieldValue);
        await MultipleClassRegistrationPaymentStatus(record.id, 'ROII-Cancelled');
    }
}


async function runPeriodically1(task, intervalMs) {
    console.log("Starting periodic task processRefundRequests...");
    setInterval(async () => {
        console.log(`Running task at ${new Date().toISOString()}`);
        await task();
    }, intervalMs);
}

// Update the periodic calls
runPeriodically1(processRefundRequests, 50000);
runPeriodically1(processPaymentStatusChanges, 50000);


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

            return paymentStatus === 'Cancelled Without Refund' && refundConfirmation === 'Confirmed';
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

async function managePaymentUpdates() {
    try {
        const response = await axios.get(airtableUrl, {
            headers: {
                Authorization: `Bearer ${AIRTABLE_API_KEY}`,
            },
        });

        const records = response.data.records.filter(record => {
            const refundConfirmation = record.fields['Refund Confirmation'];
            const paymentStatus = record.fields['Payment Status'];

            if (refundConfirmation === 'Confirmed' || refundConfirmation === 'Cancellation Revoked') {
                return false;
            }

            return paymentStatus === 'Cancelled Without Refund';
        });

        for (const record of records) {
            await amendAirtableRecord(record.id, { 'Refund Confirmation': 'Cancellation Initiated' });
        }
    } catch (error) {
        console.error(`Error handling Payment Status updates: ${JSON.stringify(error.response?.data || error.message)}`);
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

        await amendAirtableRecord(record.id, {
            'Refund Confirmation': 'Confirmed',
            'Payment Status': 'Cancelled Without Refund',
            'Number of seat Purchased': 0,
        });

        await updateSeatsInClass(seatsPurchased, classFieldValue);
        await updateClassStatuses(record.id, 'Cancelled Without Refund');
    }
}

async function runPeriodically2(task, intervalMs) {
    console.log("Starting periodic task handleRefundProcessing...");
    setInterval(async () => {
        console.log(`Running task at ${new Date().toISOString()}`);
        await task();
    }, intervalMs);
}

// Update the periodic calls
runPeriodically2(handleRefundProcessing, 50000);
runPeriodically2(managePaymentUpdates, 50000);


const base = new Airtable({ apiKey: AIRTABLE_API_KEY }).base(AIRTABLE_BASE_ID);

// Function to process and update rows
async function processRows() {
  try {
    // Fetch all records in the table
    const records = await base(AIRTABLE_TABLE_NAME).select().all();

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
            'Publish / Unpublish':"Update"
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


const PORT = process.env.PORT || 6000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
