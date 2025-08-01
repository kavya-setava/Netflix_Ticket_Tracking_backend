const NetflixTicket = require('../models/Netflixupdateschema');
const { google } = require('googleapis');
const path = require('path');
const UserData =  require('../models/UserSchema')
require('dotenv').config();

const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});





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




/**
 * Returns the current time in IST (UTC+5:30) as a Date object.
 * This function assumes system is already in IST (like India servers or local dev).
 * If server is in different timezone, use Intl-based version instead.
 * @returns {Date} The current time in IST.
 */
function getCurrentIST() {
  return new Date(); // Assumes server is in IST (e.g., Asia/Kolkata)
}



/**
 * Parses a date string in "YYYY-MM-DD HH:mm:ss" format as IST.
 * @param {string} dateString The date string to parse.
 * @returns {Date} A Date object representing the time in IST.
 */
function parseISTDate(dateString) {
  const istDateString = dateString + " +05:30";
  return new Date(istDateString);
}

/**
 * Formats a duration in milliseconds into "HH:mm:ss".
 * @param {number} ms The duration in milliseconds.
 * @returns {string} The formatted time string.
 */
function formatTimeRemaining(ms) {
  if (ms <= 0) return "00:00:00";

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((ms % (1000 * 60)) / 1000);

  const pad = num => num.toString().padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Main Express API
exports.getNetflixTickets = async (req, res) => {
  try {
    const { email, cm_region } = req.query;
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
      limit = 25,
      ticketIDList,
      ticketKeyList,
      cmNameList,
      cmEmailList,
      amNameList,
      cmRegionList,
      statusList
    } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await UserData.findOne({ emailId: email });
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const role = user.role;
    let isCM = false;

    if (role === 1) {
      const cmTicket = await NetflixTicket.findOne({ CM_email: email }).select('_id');
      if (!cmTicket) {
        return res.status(404).json({ success: false, error: 'No tickets found for this user' });
      }
      isCM = true;
    }

    const ensureArray = (value) => {
      if (!value) return null;
      if (Array.isArray(value)) return value;
      return String(value).split(',').map((v) => v.trim()).filter(Boolean);
    };

    let query = {};
    if (role === 1) query.CM_email = email;
    if (cm_region) query.cm_region = cm_region;
    if (status) query.status = status;
    if (startTime) query.startTime = startTime;
    if (endTime) query.endTime = endTime;

    if (createdFrom || createdTo) {
      query.created = {};
      if (createdFrom) query.created.$gte = createdFrom;
      if (createdTo) query.created.$lte = createdTo;
    }

    if (updatedFrom || updatedTo) {
      query.updated = {};
      if (updatedFrom) query.updated.$gte = updatedFrom;
      if (updatedTo) query.updated.$lte = updatedTo;
    }

    const multiFilters = [
      { key: 'ticketID', value: ensureArray(ticketIDList) },
      { key: 'ticketKey', value: ensureArray(ticketKeyList) },
      { key: 'CM_name', value: ensureArray(cmNameList) },
      { key: 'CM_email', value: ensureArray(cmEmailList) },
      { key: 'AM_name', value: ensureArray(amNameList) },
      { key: 'cm_region', value: ensureArray(cmRegionList) },
      { key: 'status', value: ensureArray(statusList) }
    ];

    multiFilters.forEach(({ key, value }) => {
      if (value && value.length > 0) {
        query[key] = { $in: value };
      }
    });

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

    const [total, assignedCount, closedCount] = await Promise.all([
      NetflixTicket.countDocuments(query),
      NetflixTicket.countDocuments({ ...query, status: 'Assigned' }),
      NetflixTicket.countDocuments({ ...query, status: 'Closed' })
    ]);

    if (role === 0 && total === 0) {
      return res.status(404).json({ success: false, error: 'No tickets found' });
    }

    const tickets = await NetflixTicket.find(query)
      .sort({ updated: 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    const processedTickets = tickets.map(ticket => {
      const updatedTime = parseISTDate(ticket.updated);
      const slaDeadline = new Date(updatedTime.getTime() + (2 * 60 * 60 * 1000));
      const nowIST = getCurrentIST();

      const timeRemainingMs = slaDeadline.getTime() - nowIST.getTime();
      const timeRemaining = formatTimeRemaining(timeRemainingMs);
      const isBreached = timeRemainingMs <= 0;

      let status = 'Normal';
      if (isBreached) {
        status = 'Breached';
      } else if (timeRemainingMs < 3600000) {
        status = 'Critical';
      }


      function formatISTDateYMD(date) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, '0');
  const dd = String(istDate.getDate()).padStart(2, '0');
  const hh = String(istDate.getHours()).padStart(2, '0');
  const mi = String(istDate.getMinutes()).padStart(2, '0');
  const ss = String(istDate.getSeconds()).padStart(2, '0');

  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}


      return {
        ...ticket,
        pauseTime: ticket.pauseTime || '00:00:00',
        slaData: {
          deadline: formatISTDateYMD(slaDeadline),
          timeRemaining,
          isBreached,
          status,
          debug: {
            localUpdated: updatedTime.toString(),
            localDeadline: slaDeadline.toString(),
            localNow: nowIST.toString()
          }
        }
      };
    });

    const breachedSLAs = processedTickets.filter(t => t.slaData.isBreached).length;
    const criticalSLAs = processedTickets.filter(t => t.slaData.status === 'Critical').length;
    const normalSLAs = processedTickets.filter(t => t.slaData.status === 'Normal').length;

    res.status(200).json({
      success: true,
      count: processedTickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: processedTickets,
      userType: isCM ? 'CM' : 'QM',
      metrics: {
        totalTickets: total,
        assignedTickets: assignedCount,
        closedTickets: closedCount,
        slaMetrics: {
          breached: breachedSLAs,
          critical: criticalSLAs,
          normal: normalSLAs
        }
      }
    });

  } catch (error) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};




exports.updateTicketByKey = async (req, res) => {
  try {
    const { ticketKey } = req.params;
    const { status, startTime, endTime, SLA } = req.body;

    console.log("🔄 Updating ticket:", ticketKey);

    const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey.trim() });

    if (!existingTicket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const updateData = {
      status: status ?? existingTicket.status,
      startTime: startTime ?? existingTicket.startTime,
      endTime: endTime ?? existingTicket.endTime,
      SLA: SLA ?? existingTicket.SLA,
      updateddate: new Date()
    };

    const updatedTicket = await NetflixTicket.findOneAndUpdate(
      { ticketKey: ticketKey.trim() },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // ✅ Update Google Sheet if status changed
    if (status !== undefined && status !== existingTicket.status) {
      try {
        console.log('................try');
        
        const sheetsClient = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: sheetsClient });

        const spreadsheetId = '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4';
        const sheetName = 'Sheet1';
        
        const sheetResponse = await sheets.spreadsheets.values.get({
          spreadsheetId,
          range: `${sheetName}!A2:H`,
        });

        const rows = sheetResponse.data.values || [];
        
        const rowIndex = rows.findIndex(row => row[0]?.trim() === ticketKey.trim());
        
        console.log(`🧩 Found ticket at row index: ${rowIndex}`);

        if (rowIndex !== -1) {
          const sheetRange = `${sheetName}!H${rowIndex + 2}`; // +2 for header offset
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: sheetRange,
            valueInputOption: 'RAW',
            resource: {
              values: [[status]],
            },
          });

          console.log(`✅ Sheet updated for ${ticketKey} in range ${sheetRange}`);
        } else {
          console.warn(`⚠️ Ticket ${ticketKey} not found in Google Sheet`);
        }

      } catch (sheetError) {
        console.error('❌ Google Sheet update error:', sheetError.response?.data || sheetError.message);
      }
    }

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully',
      data: updatedTicket,
      sheetUpdated: status !== undefined && status !== existingTicket.status
    });

  } catch (error) {
    console.error('⛔ Internal error:', error);

    if (error.name === 'ValidationError') {
      const details = {};
      for (let key in error.errors) {
        details[key] = error.errors[key].message;
      }
      return res.status(400).json({ success: false, error: 'Validation failed', details });
    }

    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};


exports.CMTicketsFilterOptions = async (req, res) => {
  try {
    const ticketData = await NetflixTicket.find(
      {
        ticketKey: { $ne: '' },
        CM_name: { $ne: '' }
      },
      { ticketKey: 1, CM_name: 1, _id: 0 }
    );

    // Optional: Remove duplicates
    const uniqueMap = {};
    const formattedList = [];

    ticketData.forEach(item => {
      const key = `${item.ticketKey}_${item.CM_name}`;
      if (!uniqueMap[key]) {
        uniqueMap[key] = true;
        formattedList.push({
          ticketkey: item.ticketKey,
          ticketname: item.CM_name
        });
      }
    });

    res.status(200).json({
      success: true,
      data: formattedList
    });
  } catch (error) {
    console.error('Error fetching ticketKey and CM_name pairs:', error);
    res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
};



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
