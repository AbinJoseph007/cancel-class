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

app.get('/keep-alive', (req, res) => {
    res.send('Service is alive');
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


const tasks = [
    { name: "processRefundRequests", task: processRefundRequests },
    { name: "handleRefundProcessing", task: handleRefundProcessing },
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
            // 'Additional seat': "0", // Reset to default
            // 'Reduce Seat': "0", // Reset to default
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

const INTERVAL_MS = 40000; 



async function processPayments() {
    try {
        console.log("Fetching records from Airtable...");

        // Fetch records with filtering
        const records = await base(AIRTABLE_TABLE_NAME3)
            .select({
                filterByFormula: `AND(
                    {Booking Type} = "Admin booked",
                    NOT({Amount Total} = ""),
                    {Payment Status} = "Pay",
                    OR(
                        {Payment ID} = "",
                        NOT({Payment ID})
                    )
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

            // Extract and validate necessary fields
            const email = record.get('Email');
            const amountTotalField = record.get('Amount Total');
            const paymentID = record.get('Payment ID');
            const seatsPurchased = parseInt(record.get('Number of seat Purchased'), 10) || 0; // Extracted field
            const classId1 = record.get('Biaw Classes'); // Assuming a field linking to the class
            const amountTotal = amountTotalField
                ? parseFloat(amountTotalField.replace('$', '').trim()) * 100 // Convert to cents
                : NaN;

            if (!email || isNaN(amountTotal) || seatsPurchased <= 0 || !classId1) {
                console.log(
                    `Skipping record due to missing or invalid data. Record ID: ${record.id}`,
                    { email, amountTotal, seatsPurchased, classId1 }
                );
                continue;
            }

            if (paymentID) {
                console.log(
                    `Skipping record: Payment already made. Record ID: ${record.id}, Payment ID: ${paymentID}`
                );
                continue;
            }

            try {
                // Here we're using Stripe's predefined test card (test card ID)
                const testCardPaymentMethod = "pm_card_visa";  // This is the predefined test Payment Method ID

                console.log(`Creating payment for ${email} with amount ${amountTotal} cents.`);

                // Create a Stripe Payment Intent using the test Payment Method ID
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amountTotal,
                    currency: 'usd',
                    receipt_email: email,
                    description: `Payment for booking: ${record.id}`,
                    payment_method: testCardPaymentMethod,  // Use the test Payment Method ID
                    confirm: true,  // Automatically confirm the payment
                    automatic_payment_methods: {
                        enabled: true,  // Enable automatic payment methods selection
                        allow_redirects: "never"  // Prevent redirects (optional)
                    }
                });

                console.log(`Payment successful for ${email}: ${paymentIntent.id}`);

                // Update Airtable record with Payment ID and Payment Status
                await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                    'Payment ID': paymentIntent.id,
                    'Payment Status': 'Paid',
                    'ROII member': 'No'
                });

                console.log(
                    `Updated Airtable record ${record.id} with Payment ID ${paymentIntent.id} and Payment Status 'Paid'.`
                );

                // Update seats in the class
                await updateSeatsInClass1(seatsPurchased, classId1);
            } catch (error) {
                console.error(
                    `Failed to create payment for ${email} or update Airtable. Error: ${error.message}`
                );
            }
        }
    } catch (error) {
        console.error(
            `Error fetching records or processing payments: ${error.message}`
        );
    }
}


  
  async function updateSeatsInClass1(seatsToAdjust1, classId1) {
    try {
        // Fetch class record from Airtable
        const classRecord = await base(AIRTABLE_TABLE_NAME).find(classId1);

        if (classRecord) {
            // Fetch the number of seats from the class record
            const currentRemainingSeats1 = parseInt(classRecord.fields['Number of seats remaining'], 10) || 0;
            const currentTotalPurchasedSeats1 = parseInt(classRecord.fields['Total Number of Purchased Seats'], 10) || 0;

            // Calculate the updated values based on the payment
            const updatedRemainingSeats1 = (currentRemainingSeats1 - seatsToAdjust1).toString();
            const updatedTotalSeats1 = (currentTotalPurchasedSeats1 + seatsToAdjust1).toString();

            console.log('Updating Biaw Classes:', {
                'Number of seats remaining': updatedRemainingSeats1,
                'Total Number of Purchased Seats': updatedTotalSeats1,
            });

            // Update Airtable record with new values
            await axios.patch(`${biawClassesUrl}/${classRecord.id}`, {
                fields: {
                    'Number of seats remaining': updatedRemainingSeats1,
                    'Total Number of Purchased Seats': updatedTotalSeats1,
                },
            }, {
                headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` },
            });

            console.log(`Updated Biaw Classes record: ${classRecord.id}`);
        }
    } catch (error) {
        if (error.response?.data) {
            console.error(`Error updating class. Airtable response: ${JSON.stringify(error.response.data)}`);
        } else {
            console.error(`Error updating class: ${error.message}`);
        }
    }
}

  // Execute the function
  processPayments();
  
  
  setInterval(() => {
    console.log("Checking for updates2...");
    processPayments();
  }, INTERVAL_MS);

  async function processPayments1() {
    try {
        console.log("Fetching records from Airtable...");
  
        // Fetch records with filtering
        const records = await base(AIRTABLE_TABLE_NAME3)
          .select({
            filterByFormula: `AND(
                {Booking Type} = "Admin booked",
                {Payment Status} = "ROII-Free",
                {ROII member} = ""
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
                // Update Airtable record with Payment Status as "Paid" (optional)
                await base(AIRTABLE_TABLE_NAME3).update(record.id, {
                    'Payment Status': 'ROII-Free',
                    'ROII member':'Yes' // Optionally set this field to 'Paid' for tracking
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
        filterByFormula: `AND({% Discounts} > 0, {Coupon Code} = "", {Member Price ID} != "", {Non-Member Price ID} != "", {Publish / Unpublish} != "Deleted")`
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
