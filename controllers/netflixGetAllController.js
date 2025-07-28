
const NetflixTicket = require('../models/Netflixupdateschema');
const { google } = require('googleapis');
const path = require('path');



exports.postticketsdata = async (req, res) => {
  try {
    // Create ticket data object with all fields from the schema
    const ticketData = {
      ticketKey: req.body.ticketKey || undefined, // Optional field
      CM_name: req.body.CM_name,
      CM_email: req.body.CM_email,
      cm_region: req.body.cm_region || '',
      AM_name: req.body.AM_name || '',
      // New fields with defaults from schema
      startTime: req.body.startTime || '00:00:00',
      endTime: req.body.endTime || '00:00:00',
      status: req.body.status || '',
      SLA: req.body.SLA || "", // Empty string default
      // Timestamps will be auto-handled by schema pre-save hooks
    };

    // Save the ticket (schema hooks will handle ticketID and timestamps)
    const savedTicket = await NetflixTicket.create(ticketData);

    // Return success response
    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      data: savedTicket
    });

  } catch (error) {
    console.error('Error creating ticket:', error);
    
    // Handle duplicate key error (for ticketID or ticketKey if unique)
    if (error.code === 11000) {
      return res.status(409).json({ 
        success: false,
        error: error.keyValue?.ticketID ? 'Duplicate ticket ID' : 'Duplicate ticket key',
        field: Object.keys(error.keyValue)[0]
      });
    }
    
    // Handle validation errors (e.g., email format)
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        details: errors 
      });
    }

    // Generic server error
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};



exports.getNetflixTickets = async (req, res) => {
  try {
    const { email, role, cm_region } = req.query;
    
    const { 
      status,
      startTime,
      endTime,
      createdFrom, 
      createdTo, 
      updatedFrom, 
      updatedTo,
      searchText,
      page = 1,
      limit = 10
    } = req.query;
    
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    // Validate role
    if (role !== '0' && role !== '1') {
      return res.status(400).json({ success: false, error: 'Invalid role specified' });
    }

    // Check user authorization
    let isCM = false;
    if (role === '1') {
      const cmTicket = await NetflixTicket.findOne({ CM_email: email }).select('_id');
      if (!cmTicket) {
        return res.status(404).json({ success: false, error: 'No tickets found for this user' });
      }
      isCM = true;
    }

    // Build the base query
    let query = {};
    
    // If role is CM (0), only show their own tickets
    if (role === '1') {
      query.CM_email = email;
    }

    // Add cm_region filter if provided
    if (cm_region) {
      query.cm_region = cm_region;
    }

    // Add status filter if provided
    if (status) {
      query.status = status;
    }

    // Add time filters if provided
    if (startTime) {
      query.startTime = startTime;
    }
    if (endTime) {
      query.endTime = endTime;
    }

    // Add date range filters for created
    const createdDateFilters = {};
    if (createdFrom) {
      createdDateFilters.$gte = new Date(createdFrom);
    }
    if (createdTo) {
      createdDateFilters.$lte = new Date(createdTo);
    }
    if (Object.keys(createdDateFilters).length > 0) {
      query.created = createdDateFilters;
    }

    // Add date range filters for updated
    const updatedDateFilters = {};
    if (updatedFrom) {
      updatedDateFilters.$gte = new Date(updatedFrom);
    }
    if (updatedTo) {
      updatedDateFilters.$lte = new Date(updatedTo);
    }
    if (Object.keys(updatedDateFilters).length > 0) {
      query.updated = updatedDateFilters;
    }

    // Add text search if provided
    if (searchText) {
      query.$or = [
        { ticketID: { $regex: searchText, $options: 'i' } },
        { ticketKey: { $regex: searchText, $options: 'i' } },
        { CM_name: { $regex: searchText, $options: 'i' } },
        { CM_email: { $regex: searchText, $options: 'i' } },
        { AM_name: { $regex: searchText, $options: 'i' } },
        { cm_region: { $regex: searchText, $options: 'i' } },
        { status: { $regex: searchText, $options: 'i' } }
      ];
    }

    // Get total count for pagination
    const total = await NetflixTicket.countDocuments(query);

    // If no results found for CM, return message
    if (role === '0' && total === 0) {
      return res.status(404).json({ success: false, error: 'No tickets found for this user' });
    }

    // Fetch paginated results
    const tickets = await NetflixTicket.find(query)
      .sort({ updated: 1 })  // Changed from updatedAt to updated
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: tickets,
      userType: isCM ? 'CM' : 'QM'
    });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      // details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};




// // Configure Google Sheets API
// const sheets = google.sheets({
//   version: 'v4',
//   auth: 'AIzaSyAd7mk5rSyABQQyr40r3gWMs0ZMuMWE_Hw' // Your API key
// });

// exports.updateTicketByKey = async (req, res) => {
//   try {
//     const { ticketKey } = req.params;
//     const { status, startTime, endTime, SLA } = req.body;
//     console.log("Updating ticket:", ticketKey);

//     // First find the existing ticket
//     const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey });
    
//     if (!existingTicket) {
//       return res.status(404).json({
//         success: false,
//         error: 'Ticket not found with the provided ticketKey'
//       });
//     }

//     // Validate that at least one updatable field is provided
//     if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined) {
//       return res.status(400).json({
//         success: false,
//         error: 'At least one field to update (status, startTime, endTime, or SLA) is required'
//       });
//     }

//     // Build the update object
//     const updateData = {
//       status: status !== undefined ? status : existingTicket.status,
//       startTime: startTime !== undefined ? startTime : existingTicket.startTime,
//       endTime: endTime !== undefined ? endTime : existingTicket.endTime,
//       SLA: SLA !== undefined ? SLA : existingTicket.SLA,
//       updateddate: new Date()
//     };

//     // Update MongoDB
//     const updatedTicket = await NetflixTicket.findOneAndUpdate(
//       { ticketKey: ticketKey },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     // If status changed, update Google Sheet
//     if (status !== undefined && status !== existingTicket.status) {
//       try {
//         // First find the row number of the ticket in the sheet
//         const sheetResponse = await sheets.spreadsheets.values.get({
//           spreadsheetId: '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4',
//           range: 'Sheet1!A2:H', // Assuming headers are in row 1
//         });

//         const rows = sheetResponse.data.values;
//         const rowIndex = rows.findIndex(row => row[0] === ticketKey);

//         if (rowIndex !== -1) {
//           // Update the status in Google Sheets (column H is index 7)
//           await sheets.spreadsheets.values.update({
//             spreadsheetId: '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4',
//             range: `Sheet1!H${rowIndex + 2}`, // +2 because header row + zero-based index
//             valueInputOption: 'RAW',
//             resource: {
//               values: [[status]]
//             }
//           });
//           console.log(`Updated status in Google Sheet for ticket ${ticketKey}`);
//         } else {
//           console.log(`Ticket ${ticketKey} not found in Google Sheet`);
//         }
//       } catch (sheetError) {
//         console.error('Error updating Google Sheet:', sheetError.message);
//         // Continue with the response even if sheet update fails
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Ticket updated successfully',
//       data: updatedTicket,
//       sheetUpdated: status !== undefined && status !== existingTicket.status
//     });

//   } catch (error) {
//     console.error('Error updating ticket:', error);
    
//     if (error.name === 'ValidationError') {
//       const errors = {};
//       Object.keys(error.errors).forEach(key => {
//         errors[key] = error.errors[key].message;
//       });
//       return res.status(400).json({ 
//         success: false,
//         error: 'Validation failed',
//         details: errors 
//       });
//     }

//     res.status(500).json({ 
//       success: false,
//       error: 'Internal server error'
//     });
//   }
// };



// Load service account credentials
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

console.log('auth',auth);


exports.updateTicketByKey = async (req, res) => {
  try {
    const { ticketKey } = req.params;
    const { status, startTime, endTime, SLA } = req.body;
    console.log("Updating ticket:", ticketKey);

    // First find the existing ticket
    const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey });
    
    if (!existingTicket) {
      return res.status(404).json({
        success: false,
        error: 'Ticket not found with the provided ticketKey'
      });
    }

    // Validate that at least one updatable field is provided
    if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined) {
      return res.status(400).json({
        success: false,
        error: 'At least one field to update (status, startTime, endTime, or SLA) is required'
      });
    }

    // Build the update object
    const updateData = {
      status: status !== undefined ? status : existingTicket.status,
      startTime: startTime !== undefined ? startTime : existingTicket.startTime,
      endTime: endTime !== undefined ? endTime : existingTicket.endTime,
      SLA: SLA !== undefined ? SLA : existingTicket.SLA,
      updateddate: new Date()
    };

    // Update MongoDB
    const updatedTicket = await NetflixTicket.findOneAndUpdate(
      { ticketKey: ticketKey },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // If status changed, update Google Sheet
    if (status !== undefined && status !== existingTicket.status) {
      try {
        const sheets = google.sheets({ version: 'v4', auth });
        
        // First find the row number of the ticket in the sheet
        const sheetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId: '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4',
          range: 'Sheet1!A2:H', // Data starts from row 2
        });

        const rows = sheetResponse.data.values;
        const rowIndex = rows.findIndex(row => row[0] === ticketKey);

        if (rowIndex !== -1) {
          // Update the status in Google Sheets (column H is index 7)
          await sheets.spreadsheets.values.update({
            spreadsheetId: '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4',
            range: `Sheet1!H${rowIndex + 2}`, // +2 because header row + zero-based index
            valueInputOption: 'RAW',
            resource: {
              values: [[status]]
            }
          });
          console.log(`✅ Updated status in Google Sheet for ticket ${ticketKey}`);
        } else {
          console.log(`⚠️ Ticket ${ticketKey} not found in Google Sheet`);
        }
      } catch (sheetError) {
        console.error('❌ Error updating Google Sheet:', sheetError.message);
        // Continue with the response even if sheet update fails
      }
    }

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: updatedTicket,
      sheetUpdated: status !== undefined && status !== existingTicket.status
    });

  } catch (error) {
    console.error('⛔ Error updating ticket:', error);
    
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        success: false,
        error: 'Validation failed',
        details: errors 
      });
    }

    res.status(500).json({ 
      success: false,
      error: 'Internal server error'
    });
  }
};



// exports.updateTicketByKey = async (req, res) => {
//   try {
//     const { ticketKey } = req.params;
//     const { status, startTime, endTime, SLA } = req.body;
//     console.log("ticketKey", ticketKey);

//     // First find the existing ticket
//     const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey });
    
//     if (!existingTicket) {
//       return res.status(404).json({
//         success: false,
//         error: 'Ticket not found with the provided ticketKey'
//       });
//     }

//     // Validate that at least one updatable field is provided
//     if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined) {
//       return res.status(400).json({
//         success: false,
//         error: 'At least one field to update (status, startTime, endTime, or SLA) is required'
//       });
//     }

//     // Build the update object, preserving existing values if not provided
//     const updateData = {
//       status: status !== undefined ? status : existingTicket.status,
//       startTime: startTime !== undefined ? startTime : existingTicket.startTime,
//       endTime: endTime !== undefined ? endTime : existingTicket.endTime,
//       SLA: SLA !== undefined ? SLA : existingTicket.SLA,
//       updateddate: new Date()
//     };

//     // Find and update the ticket
//     const updatedTicket = await NetflixTicket.findOneAndUpdate(
//       { ticketKey: ticketKey },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Ticket updated successfully',
//       data: updatedTicket
//     });

//   } catch (error) {
//     console.error('Error updating ticket:', error);
    
//     // Handle validation errors
//     if (error.name === 'ValidationError') {
//       const errors = {};
//       Object.keys(error.errors).forEach(key => {
//         errors[key] = error.errors[key].message;
//       });
//       return res.status(400).json({ 
//         success: false,
//         error: 'Validation failed',
//         details: errors 
//       });
//     }

//     // Generic server error
//     res.status(500).json({ 
//       success: false,
//       error: 'Internal server error',
//       // details: process.env.NODE_ENV === 'development' ? error.message : undefined
//     });
//   }
// };

exports.qmdata = async (req, res) => {
  try {
    // Validate required fields
    if (!req.body.name || !req.body.jiraUserId || !req.body.emailId || !req.body.region) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Create new document
    const newCM = new CM({
      name: req.body.name,
      jiraUserId: req.body.jiraUserId,
      emailId: req.body.emailId,
      region: req.body.region,
      role:req.body.role
    });

    // Save to database
    const savedCM = await newCM.save();
    
    // Return success response
    res.status(201).json({
      message: 'CM record created successfully',
      data: savedCM
    });
  } catch (err) {
    console.error('Error creating CM record:', err);
    res.status(500).json({ 
      error: 'Internal server error',
      details: err.message 
    });
  }
};
