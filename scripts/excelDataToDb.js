// const fs = require('fs');
// const csv = require('csv-parser');
// const path = require('path');
// const mongoose = require('mongoose');
// const CM = require('../models/cmSchema');


// cm data 

// async function processCSV() {
//   // Connect to MongoDB
//   await mongoose.connect('mongodb+srv://mcube:123@cluster0.mvb09va.mongodb.net/netflix_db', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true
//   });
//   console.log('Connected to MongoDB');

//   const results = [];
//   const downloadsPath = path.join(require('os').homedir(), 'Downloads');
//   const csvFilePath = path.join(downloadsPath, 'Netflix Ticketing System  - cmdata.csv');
  
//   // Read CSV file
//   fs.createReadStream(csvFilePath)
//     .pipe(csv({
//       headers: ['name', 'jiraUserId', 'emailId', 'region', 'role'],
//       skipLines: 1 // Skip header row
//     }))
//     .on('data', (data) => {
//       // Filter out empty rows and rows without name
//       if (data.name && data.name.trim() !== '') {
//         results.push(data);
//       }
//     })
//     .on('end', async () => {
//       try {
//         // Insert data into MongoDB
//         for (const item of results) {
//           const cm = new CM({
//             name: item.name,
//             jiraUserId: item.jiraUserId,
//             emailId: item.emailId,
//             region: item.region,
//             role: parseInt(item.role) || 0 // Default to 0 if role is not provided
//           });
          
//           await cm.save();
//           console.log(`Saved: ${cm.name} with CMID: ${cm.cmid}`);
//         }
        
//         console.log('All data processed successfully');
//         await mongoose.connection.close();
//       } catch (err) {
//         console.error('Error saving data:', err);
//         await mongoose.connection.close();
//       }
//     });
// }

// // Run the processing
// processCSV().catch(err => console.error('Error in processCSV:', err));


// QM data


// const fs = require('fs');
// const csv = require('csv-parser');
// const path = require('path');
// const mongoose = require('mongoose');
// const QM = require('../models/qmSchema');

// async function importQMData() {
//   try {
//     // Connect to MongoDB
//     await mongoose.connect('mongodb+srv://mcube:123@cluster0.mvb09va.mongodb.net/netflix_db', {
//       useNewUrlParser: true,
//       useUnifiedTopology: true
//     });
//     console.log('Connected to MongoDB');

//     const results = [];
//     const downloadsPath = path.join(require('os').homedir(), 'Downloads');
//     const csvFilePath = path.join(downloadsPath, 'Netflix Ticketing System  - cmdata.csv');

//     // Read CSV file with role column
//     await new Promise((resolve, reject) => {
//       fs.createReadStream(csvFilePath)
//         .pipe(csv({
//           headers: ['name', 'jiraUserId', 'emailId', 'region', 'role'], // Added role
//           skipLines: 1 // Skip header row
//         }))
//         .on('data', (data) => {
//           if (data.name && data.name.trim() !== '') {
//             // Convert role to number, default to 0 if not provided
//             data.role = data.role ? parseInt(data.role) : 0;
//             results.push(data);
//           }
//         })
//         .on('end', resolve)
//         .on('error', reject);
//     });

//     // Insert data into MongoDB
//     for (const item of results) {
//       const qm = new QM({
//         name: item.name,
//         jiraUserId: item.jiraUserId,
//         emailId: item.emailId,
//         region: item.region,
//         role: item.role // Include role in the document
//       });
      
//       await qm.save();
//       console.log(`Saved: ${qm.name} with QMID: ${qm.qmid} and Role: ${qm.role}`);
//     }

//     console.log('All QM data processed successfully');
//   } catch (err) {
//     console.error('Error processing QM data:', err);
//   } finally {
//     await mongoose.connection.close();
//   }
// }

// // Run the import
// importQMData();



const mongoose = require('mongoose');
const { google } = require('googleapis');
const NetflixTicket = require('../models/netflixUpdateSchema');
const cron = require('node-cron');


// Configuration
const SPREADSHEET_ID = '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4';
const SHEET_NAME = 'Sheet1';
const RANGE = 'A1:H';
const mongoURI = 'mongodb+srv://mcube:123@cluster0.mvb09va.mongodb.net/netflix_db';
const API_KEY = 'AIzaSyAd7mk5rSyABQQyr40r3gWMs0ZMuMWE_Hw';

// Helper function to properly parse Excel dates
function parseExcelDate(dateString) {
  if (!dateString) return null;
  
  // Split the date and time parts
  const [datePart, timePart] = dateString.split(' ');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes, seconds] = timePart.split(':').map(Number);

  // Create a new Date object in UTC
  return new Date(Date.UTC(year, month - 1, day, hours, minutes, seconds));
}

async function getSheetData() {
  try {
    const sheets = google.sheets({
      version: 'v4',
      auth: API_KEY
    });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!${RANGE}`,
    });
    
    const [headers, ...rows] = response.data.values;
    return { headers, rows };
  } catch (error) {
    console.error('Error reading Google Sheet:', error.message);
    if (error.response && error.response.status === 403) {
      console.error('\nERROR: The sheet is probably not public.');
      console.error('Solution: Either make the sheet public or use service account credentials.');
    }
    process.exit(1);
  }
}

async function migrateData() {
  const startTime = new Date();
  
  try {
    // Connect to MongoDB
    console.log('⌛ Connecting to MongoDB...');
    await mongoose.connect(mongoURI);
    console.log('✅ Connected to MongoDB');

    // Delete existing data
    console.log('⌛ Deleting existing records...');
    const deleteResult = await NetflixTicket.deleteMany({});
    console.log(`♻️ Deleted ${deleteResult.deletedCount} existing records`);

    // Get data from Google Sheet
    console.log('⌛ Fetching data from Google Sheet...');
    const { headers, rows } = await getSheetData();
    
    if (!rows || rows.length === 0) {
      throw new Error('❌ No data found in the sheet');
    }

    console.log(`📊 Found ${rows.length} rows in Google Sheet`);

    // Create column mapping
    const columnMap = {
      ticketKey: headers.indexOf('Issue key'),
      created: headers.indexOf('Created'),
      updated: headers.indexOf('Updated'),
      AM_name: headers.indexOf('Reporter'),
      CM_name: headers.indexOf('Assignee'),
      CM_email: headers.indexOf('Assignee_mail_id'),
      cm_region: headers.indexOf('Assignee_region'),
      status: headers.indexOf('Status')
    };

    // Verify all required columns exist
    for (const [field, index] of Object.entries(columnMap)) {
      if (index === -1) {
        throw new Error(`❌ Required column not found for field: ${field}`);
      }
    }

    // Process and insert tickets
    let successCount = 0;
    let errorCount = 0;
    const totalRows = rows.length;
    const dbInsertStart = new Date();

    console.log('⏳ Starting data migration...');
    
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
      const ticketData = {
  ticketKey: row[columnMap.ticketKey],
  created: row[columnMap.created],  // Store as string from sheet (with time zone)
  updated: row[columnMap.updated],  // Store as string from sheet (with time zone)
  AM_name: row[columnMap.AM_name],
  CM_name: row[columnMap.CM_name],
  CM_email: row[columnMap.CM_email],
  cm_region: row[columnMap.cm_region],
  status: row[columnMap.status],
  // updateddate: parseExcelDate(row[columnMap.updated]) || new Date(),
  // latest_created_date: parseExcelDate(row[columnMap.created]) || new Date()
};


      await NetflixTicket.create(ticketData);
      successCount++;
      
      // Show progress every 10 records or for the last record
      if (successCount % 10 === 0 || i === rows.length - 1) {
        console.log(`🔄 Processed ${i+1}/${totalRows} records (${successCount} successful, ${errorCount} errors)`);
      }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error inserting row ${i+1}:`, error.message);
        console.error('Problematic row data:', row);
      }
    }

    const dbInsertEnd = new Date();
    const dbInsertTime = (dbInsertEnd - dbInsertStart) / 1000;

    console.log('\n Migration Summary:');
    console.log(` Successfully inserted: ${successCount} records`);
    console.log(` Failed to insert: ${errorCount} records`);
    console.log(` Total rows processed: ${totalRows}`);
    console.log(` Data storage time: ${dbInsertTime.toFixed(2)} seconds`);
    console.log(` Insertion rate: ${(successCount/dbInsertTime).toFixed(2)} records/second`);

    await mongoose.disconnect();
    console.log(' Disconnected from MongoDB');

    const totalTime = (new Date() - startTime) / 1000;
    console.log(`\n Total operation time: ${totalTime.toFixed(2)} seconds`);
  } catch (error) {
    console.error(' Error during data migration:', error);
    process.exit(1);
  }
}


// it will run when program runs
// migrateData();


// it will run for every hour like 7:00 , 8:00 .. 
cron.schedule('0 * * * *', async () => {
  console.log(`\n🕐 Cron Job started at ${new Date().toLocaleString()}`);
  await migrateData();
});