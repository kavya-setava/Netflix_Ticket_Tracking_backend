const NetflixTicket = require('../models/Netflixupdateschema');
const { google } = require('googleapis');
const path = require('path');
const UserData =  require('../models/UserSchema')
const ticketActivity = require("../models/utilizationSchema");
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






// Get IST current datetime
function getCurrentIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// Format IST date to Y-m-d H:M:S
function formatISTDateYMD(date) {
  const istDate = new Date(date.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
  const yyyy = istDate.getFullYear();
  const mm = String(istDate.getMonth() + 1).padStart(2, "0");
  const dd = String(istDate.getDate()).padStart(2, "0");
  const hh = String(istDate.getHours()).padStart(2, "0");
  const mi = String(istDate.getMinutes()).padStart(2, "0");
  const ss = String(istDate.getSeconds()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
}

// Time remaining calculator (used by all SLA types)
function calculateTimeRemaining(slaDeadline, status, currentIST) {
  const diffMs = slaDeadline - currentIST;
  const absMs = Math.abs(diffMs);

  const hours = String(Math.floor(absMs / (1000 * 60 * 60))).padStart(2, "0");
  const minutes = String(Math.floor((absMs % (1000 * 60 * 60)) / (1000 * 60))).padStart(2, "0");
  const seconds = String(Math.floor((absMs % (1000 * 60)) / 1000)).padStart(2, "0");

  const sign = diffMs < 0 ? "-" : "";
  const timeRemaining = `${sign}${hours}:${minutes}:${seconds}`;

  let slaStatus = "Normal";
  if (["Closed", "Need More Information", "Sent to VAO"].includes(status)) {
    slaStatus = "Not Applicable";
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: slaStatus
    };
  }

  if (diffMs <= 0) slaStatus = "Breached";
  else if (diffMs < 3600000) slaStatus = "Critical"; // less than 1h

  return {
    deadline: formatISTDateYMD(slaDeadline),
    timeRemaining,
    isBreached: diffMs <= 0,
    status: slaStatus
  };
}

// SLA for Live Confirmation
// function calculateLiveConfirmationSLA(ticket, user, currentIST) {
//   if (!user || !user.shiftStart) {
//     return {
//       deadline: "N/A",
//       timeRemaining: "00:00:00",
//       isBreached: false,
//       status: "Shift Time Missing"
//     };
//   }

//   // Check if startDateTime is today
//   const startDate = new Date(ticket.startDateTime);
  
//   // const isToday =
//   //   startDate.getDate() === currentIST.getDate() &&
//   //   startDate.getMonth() === currentIST.getMonth() &&
//   //   startDate.getFullYear() === currentIST.getFullYear();

//   // if (!isToday) {
//   //   return {
//   //     deadline: "N/A",
//   //     timeRemaining: "00:00:00",
//   //     isBreached: false,
//   //     status: "Not Applicable"
//   //   };
//   // }

//   const [hh, mm] = user.shiftStart.split(":").map(Number);
  
//   // Create shift start date for today
//   const shiftStartToday = new Date(currentIST);
//   shiftStartToday.setHours(hh, mm, 0, 0);
  
//   // Calculate SLA deadline (shift start + 2 hours)
//   const slaDeadline = new Date(shiftStartToday.getTime() + 2 * 60 * 60 * 1000);

//   return calculateTimeRemaining(slaDeadline, ticket.status, currentIST);
// }

function calculateLiveConfirmationSLA(ticket, user, currentIST) {
  if (!user || !user.shiftStart) {
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: "Shift Time Missing"
    };
  }

  if (!ticket.startDateTime) {
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: "Start Date Missing"
    };
  }

  // Parse startDateTime (from ticket, not today's date)
  const startDate = new Date(ticket.startDateTime);

  // Extract shift start hours and minutes
  const [hh, mm] = user.shiftStart.split(":").map(Number);

  // Create shift start datetime on the *same day as startDate*
  const shiftStartOnStartDate = new Date(startDate);
  shiftStartOnStartDate.setHours(hh, mm, 0, 0);

  // SLA deadline = shift start + 2 hours
  const slaDeadline = new Date(shiftStartOnStartDate.getTime() + 2 * 60 * 60 * 1000);

  return calculateTimeRemaining(slaDeadline, ticket.status, currentIST);
}



// SLA for Media Plan QC (startDateTime decides, updateddate applies)
function calculateMediaPlanQCSLA(ticket, currentIST) {
  if (!ticket.startDateTime || !ticket.updateddate) {
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: "Start/Updated Date Missing"
    };
  }

  const startDate = new Date(ticket.startDateTime);
  const updated = new Date(ticket.updated);

  // Calculate difference in days between now and startDate
  const diffDays = Math.floor((currentIST - startDate) / (1000 * 60 * 60 * 24));

  let slaDeadline;
  if (diffDays <= 2) {
    slaDeadline = new Date(updated.getTime() + 2 * 60 * 60 * 1000); // +2 hrs
  } else {
    slaDeadline = new Date(updated.getTime() + 8 * 60 * 60 * 1000); // +8 hrs
  }

  return calculateTimeRemaining(slaDeadline, ticket.status, currentIST);
}

// SLA for Reporting → EOC Report
function calculateReportingEOCSLA(ticket, currentIST) {
  if (!ticket.endDateTime) {
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: "End Date Missing"
    };
  }

  const endDate = new Date(ticket.endDateTime);

  // Check if endDate is today
  // const isToday =
  //   endDate.getDate() === currentIST.getDate() &&
  //   endDate.getMonth() === currentIST.getMonth() &&
  //   endDate.getFullYear() === currentIST.getFullYear();

  // if (!isToday) {
  //   return {
  //     deadline: "N/A",
  //     timeRemaining: "00:00:00",
  //     isBreached: false,
  //     status: "Not Applicable"
  //   };
  // }

  // Set SLA deadline to end of today + 72 hours
  const endOfToday = new Date(currentIST);
  endOfToday.setHours(23, 59, 59, 999);
  const slaDeadline = new Date(endDate.getTime() + 72 * 60 * 60 * 1000);

  // const slaDeadline = new Date(endOfToday.getTime() + 72 * 60 * 60 * 1000);
  
  return calculateTimeRemaining(slaDeadline, ticket.status, currentIST);
}

// Master SLA calculator
function calculateSLA(ticket, user, currentIST) {
  if (!ticket.taskType && !ticket.subTaskType) {
    return {
      deadline: "N/A",
      timeRemaining: "00:00:00",
      isBreached: false,
      status: "Not Applicable"
    };
  }

  if (ticket.taskType === "Live Confirmation") {
    return calculateLiveConfirmationSLA(ticket, user, currentIST);
  }

  if (ticket.taskType === "Media Plan QC") {
    return calculateMediaPlanQCSLA(ticket, currentIST);
  }

  if (ticket.taskType === "Reporting" && ticket.subTaskType === "EOC Report") {
    return calculateReportingEOCSLA(ticket, currentIST);
  }

  return {
    deadline: "N/A",
    timeRemaining: "00:00:00",
    isBreached: false,
    status: "No SLA Rule"
  };
}

const secondsToHMS = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return `${h}:${m}:${s}`;
};

const hmsToSeconds = (hms) => {
  const [h, m, s] = hms.split(':').map(Number);
  return h*3600+m*60+s;
}

const calculateCurrentUtilizationTimer = (ticket) =>{
  if(!ticket){
    return "00:00:00"
  }

  let totalSeconds = hmsToSeconds(ticket.totalDuration||"00:00:00")

  const lastSession = ticket.sessions && ticket.sessions.length > 0 ? ticket.sessions[ticket.sessions.length-1] : null

  if(ticket.status === "Start"){
    const runningSeconds = Math.floor((new Date() - new Date(lastSession.startedAt))/1000)
    return secondsToHMS(runningSeconds+totalSeconds)
  }

  if(["Interim", "Solution Provided", "Need More Information", "Sent to VAO", "Closed", "Assigned"].includes(ticket.status)){
    return ticket.totalDuration || "00:00:00";
  }

  return "00:00:00"
}
// Helper function to build query
function buildQuery(params, role, email) {
  const {
    cm_region,
    status,
    startTime,
    endTime,
    createdFrom,
    createdTo,
    updatedFrom,
    updatedTo,
    searchText,
    ticketIDList,
    ticketKeyList,
    cmNameList,
    cmEmailList,
    amNameList,
    cmRegionList,
    statusList
  } = params;

  const ensureArray = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) return value;
    return String(value)
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  };

  let query = {};
  
  // ✅ CM users → filter strictly by backupCM_email
  if (role === 1) {
    query.backupCM_email = email;
  }
  
  if (cm_region) query.cm_region = cm_region;
  if (status) query.status = status;

  if (createdFrom || createdTo) {
    query.created = {};
    if (createdFrom) query.created.$gte = createdFrom;
    if (createdTo) query.created.$lte = createdTo + " 23:59:59";
  }

  if (updatedFrom || updatedTo) {
    query.updated = {};
    if (updatedFrom) query.updated.$gte = updatedFrom;
    if (updatedTo) query.updated.$lte = updatedTo + " 23:59:59";
  }

  const multiFilters = [
    { key: "ticketID", value: ensureArray(ticketIDList) },
    { key: "ticketKey", value: ensureArray(ticketKeyList) },
    { key: "CM_name", value: ensureArray(cmNameList) },
    { key: "backupCM_email", value: ensureArray(cmEmailList) }, // ✅ only backup
    { key: "AM_name", value: ensureArray(amNameList) },
    { key: "cm_region", value: ensureArray(cmRegionList) },
    { key: "status", value: ensureArray(statusList) }
  ];

  multiFilters.forEach(({ key, value }) => {
    if (value && value.length > 0) {
      query[key] = { $in: value };
    }
  });

  if (searchText) {
    query.$or = [
      { ticketID: { $regex: searchText, $options: "i" } },
      { ticketKey: { $regex: searchText, $options: "i" } },
      { CM_name: { $regex: searchText, $options: "i" } },
      { backupCM_email: { $regex: searchText, $options: "i" } }, // ✅ only backup
      { AM_name: { $regex: searchText, $options: "i" } },
      { cm_region: { $regex: searchText, $options: "i" } },
      { status: { $regex: searchText, $options: "i" } }
    ];
  }

  return query;
}


// Helper function to get status counts
async function getStatusCounts(query) {
  const statuses = [
    "Assigned", "Closed", "Start", "Interim", 
    "Need More Information", "Sent to VAO", "Solution Provided"
  ];

  const statusQuery = { ...query };
  delete statusQuery.status;

  const countPromises = statuses.map(status => 
    NetflixTicket.countDocuments({ ...statusQuery, status })
  );

  const counts = await Promise.all(countPromises);

  const result = {
    totalTickets: await NetflixTicket.countDocuments(statusQuery)
  };

  statuses.forEach((status, index) => {
    const key = `${status.toLowerCase().replace(/\s+/g, '')}Tickets`;
    result[key] = counts[index];
  });

  return result;
}

// Helper function to process tickets with SLA
async function processTicketsWithSLA(tickets, currentIST) {
  if (tickets.length === 0) return [];

  // UPDATED: Get emails from both CM_email and backupCM_email for SLA calculation
  const cmEmails = [...new Set(tickets.map(ticket => ticket.backupCM_email || ticket.CM_email))];
  const usersForSLA = await UserData.find({ 
    emailId: { $in: cmEmails } 
  }).lean();

  const userMap = {};
  usersForSLA.forEach(user => {
    userMap[user.emailId] = user;
  });

  const ticketIds = tickets.map(t => t.ticketKey);
  const activities = await ticketActivity.find({ticketId : {$in : ticketIds}}).lean()
  const activityMap = {}
  activities.forEach(a => (activityMap[a.ticketId] = a))

  return tickets.map(ticket => {
    // UPDATED: Use backupCM_email for SLA, fallback to CM_email
    const userEmail = ticket.backupCM_email || ticket.CM_email;
    const userForSLA = userMap[userEmail];
    const slaData = calculateSLA(ticket, userForSLA, currentIST);

    const utilizationData = activityMap[ticket.ticketKey]
    const utilization = utilizationData ? 
      {
        utTimer : calculateCurrentUtilizationTimer(utilizationData),
        totalDuration : utilizationData.totalDuration,
        status : utilizationData.status
      } : {
        utTimer : "00:00:00",
        status  : "Assigned"
      }
    return {
      ...ticket,
      pauseTime: ticket.pauseTime || "00:00:00",
      slaData,
      utilization
    };
  });
}

// ================== Main Controller ==================
exports.getNetflixTickets = async (req, res) => {
  try {
    const { email, cm_region, page = 1, limit = 25 } = req.query;

    if (!email) {
      return res.status(400).json({ success: false, error: "Email is required" });
    }

    const currentIST = getCurrentIST();

    // Get user and check role
    const user = await UserData.findOne({ emailId: email });
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    // For CM users, check if they have any tickets (using backupCM_email)
    if (user.role === 1) {
      const cmTicket = await NetflixTicket.findOne({ backupCM_email: email }).select("_id");

      
      if (!cmTicket) {
        return res.status(404).json({ success: false, error: "No tickets found for this user" });
      }
    }

    // Build query
    const query = buildQuery(req.query, user.role, email);

    // Get total count and status counts in parallel
    const [total, statusCounts] = await Promise.all([
      NetflixTicket.countDocuments(query),
      getStatusCounts(query)
    ]);

    // Return early if no tickets found for QM users
    if (user.role === 0 && total === 0) {
      return res.status(404).json({ success: false, error: "No tickets found" });
    }

    // Fetch tickets with optimized selection
    const tickets = await NetflixTicket.find(query)
      .select('ticketID ticketKey CM_name CM_email backupCM_email AM_name cm_region status startDateTime endDateTime updateddate pauseTime taskType subTaskType created updated asap')
      .sort({ updated: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .lean();

    // Process tickets with SLA
    const processedTickets = await processTicketsWithSLA(tickets, currentIST);

    res.status(200).json({
      success: true,
      count: processedTickets.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      data: processedTickets,
      userType: user.role === 1 ? "CM" : "QM",
      metrics: statusCounts
    });

  } catch (error) {
    console.error("Error fetching tickets:", error);
    res.status(500).json({ success: false, error: "Internal server error" });
  }
};



exports.updateTicketByKey_DB = async (req, res) => {
  try {
    const { ticketKey } = req.params;
    const { status, startTime, endTime, SLA, asap } = req.body;

    console.log("🔄 Updating ticket in DB:", ticketKey);

    const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey.trim() });

    if (!existingTicket) {
      return res.status(404).json({ success: false, error: 'Ticket not found' });
    }

    if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined && asap === undefined) {
      return res.status(400).json({ success: false, error: 'No fields to update' });
    }

    const updateData = {
      status: status ?? existingTicket.status,
      startTime: startTime ?? existingTicket.startTime,
      endTime: endTime ?? existingTicket.endTime,
      SLA: SLA ?? existingTicket.SLA,
      asap: asap ?? existingTicket.asap,
      updateddate: new Date()
    };

    const updatedTicket = await NetflixTicket.findOneAndUpdate(
      { ticketKey: ticketKey.trim() },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // === ENABLE/DISABLE LOGIC ===

    if (updateData.status === "Start") {
      // Rule 1: Start → enable current, disable others
      await NetflixTicket.updateMany(
        { ticketKey: { $ne: ticketKey.trim() } },
        { $set: { enable: false } }
      );
      await NetflixTicket.updateOne(
        { ticketKey: ticketKey.trim() },
        { $set: { enable: true } }
      );

    } else if (updateData.status === "Assigned") {
      // Rule: Assigned → enable only tickets with status "Assigned"
      await NetflixTicket.updateMany(
        { status: "Assigned" },
        { $set: { enable: true } }
      );
      await NetflixTicket.updateMany(
        { status: { $ne: "Assigned" } },
        { $set: { enable: false } }
      );

    } else if (updateData.status !== "Start" && updateData.status !== "On Hold") {
      if (updateData.asap === false) {
        // Rule 2: Started ticket changed → enable only assigned tickets
        await NetflixTicket.updateMany(
          { status: "Assigned" },
          { $set: { enable: true } }
        );
        await NetflixTicket.updateMany(
          { status: { $ne: "Assigned" } },
          { $set: { enable: false } }
        );
        await NetflixTicket.updateOne(
          { ticketKey: ticketKey.trim() },
          { $set: { enable: false } }
        );
      } else {
        // Fallback → current false, assigned tickets true
        await NetflixTicket.updateOne(
          { ticketKey: ticketKey.trim() },
          { $set: { enable: false } }
        );
        await NetflixTicket.updateMany(
          { status: "Assigned" },
          { $set: { enable: true } }
        );
        await NetflixTicket.updateMany(
          { status: { $ne: "Assigned" } },
          { $set: { enable: false } }
        );
      }

    } else if (updateData.status === "On Hold") {
      // Rule 3: Started ticket → On Hold
      const hasAsapTickets = await NetflixTicket.exists({ asap: true });

      if (hasAsapTickets) {
        // Enable ASAP tickets
        await NetflixTicket.updateMany({ asap: true }, { $set: { enable: true } });
        // Enable the On Hold ticket
        await NetflixTicket.updateOne(
          { ticketKey: ticketKey.trim() },
          { $set: { enable: true } }
        );
      } else {
        console.log("No ASAP tickets found — keeping enable states unchanged.");
      }
    }

    // === Rule 4: If no asap:true tickets are Start or Assigned → enable only assigned tickets ===
    const asapActiveTicketsExist = await NetflixTicket.exists({
      asap: true,
      status: { $in: ["Start", "Assigned"] }
    });

    if (!asapActiveTicketsExist) {
      console.log("✅ No asap:true tickets with status 'Start' or 'Assigned' → enabling only assigned tickets");
      await NetflixTicket.updateMany(
        { status: "Assigned" },
        { $set: { enable: true } }
      );
      await NetflixTicket.updateMany(
        { status: { $ne: "Assigned" } },
        { $set: { enable: false } }
      );
    }

    res.status(200).json({
      success: true,
      message: 'Ticket updated successfully in DB',
      data: updatedTicket
    });

  } catch (error) {
    console.error('⛔ DB update error:', error);

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



// exports.updateTicketByKey_DB = async (req, res) => {
//   try {
//     const { ticketKey } = req.params;
//     const { status, startTime, endTime, SLA, asap } = req.body;

//     console.log("🔄 Updating ticket in DB:", ticketKey);

//     const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey.trim() });

//     if (!existingTicket) {
//       return res.status(404).json({ success: false, error: 'Ticket not found' });
//     }

//     if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined && asap === undefined) {
//       return res.status(400).json({ success: false, error: 'No fields to update' });
//     }

//     // --- build update object ---
//     const updateData = {
//       status: status ?? existingTicket.status,
//       startTime: startTime ?? existingTicket.startTime,
//       endTime: endTime ?? existingTicket.endTime,
//       SLA: SLA ?? existingTicket.SLA,
//       asap: asap ?? existingTicket.asap,
//       updateddate: new Date()
//     };

//     // --- Update ticket itself ---
//     const updatedTicket = await NetflixTicket.findOneAndUpdate(
//       { ticketKey: ticketKey.trim() },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     // --- Apply enable/disable logic ---
//     if (updateData.status === "Start") {
//       // 1️⃣ Current ticket enable:true, all others false
//       await NetflixTicket.updateMany(
//         { ticketKey: { $ne: ticketKey.trim() } },
//         { $set: { enable: false } }
//       );
//       await NetflixTicket.updateOne(
//         { ticketKey: ticketKey.trim() },
//         { $set: { enable: true } }
//       );

//     } else if (updateData.status !== "Start" && updateData.status !== "On Hold") {
//       if (updateData.asap === false) {
//         // 2️⃣ Requirement: started ticket changed → all enable true, current false
//         await NetflixTicket.updateMany({}, { $set: { enable: true } });
//         await NetflixTicket.updateOne(
//           { ticketKey: ticketKey.trim() },
//           { $set: { enable: false } }
//         );
//       } else {
//         // 3️⃣ Fallback case → current false, rest true
//         await NetflixTicket.updateOne(
//           { ticketKey: ticketKey.trim() },
//           { $set: { enable: false } }
//         );
//         await NetflixTicket.updateMany(
//           { ticketKey: { $ne: ticketKey.trim() } },
//           { $set: { enable: true } }
//         );
//       }
//     }
//     // If status === "On Hold" → do nothing

//     res.status(200).json({
//       success: true,
//       message: 'Ticket updated successfully in DB',
//       data: updatedTicket
//     });

//   } catch (error) {
//     console.error('⛔ DB update error:', error);

//     if (error.name === 'ValidationError') {
//       const details = {};
//       for (let key in error.errors) {
//         details[key] = error.errors[key].message;
//       }
//       return res.status(400).json({ success: false, error: 'Validation failed', details });
//     }

//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// };



// exports.updateTicketByKey_DB = async (req, res) => {
//   try {
//     const { ticketKey } = req.params;
//     const { status, startTime, endTime, SLA, asap } = req.body;

//     console.log("🔄 Updating ticket in DB:", ticketKey);

//     const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey.trim() });

//     if (!existingTicket) {
//       return res.status(404).json({ success: false, error: 'Ticket not found' });
//     }

//     if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined && asap === undefined) {
//       return res.status(400).json({ success: false, error: 'No fields to update' });
//     }

//     const updateData = {
//       status: status ?? existingTicket.status,
//       startTime: startTime ?? existingTicket.startTime,
//       endTime: endTime ?? existingTicket.endTime,
//       SLA: SLA ?? existingTicket.SLA,
//       asap: asap ?? existingTicket.asap,
//       updateddate: new Date()
//     };

//     const updatedTicket = await NetflixTicket.findOneAndUpdate(
//       { ticketKey: ticketKey.trim() },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     // === ENABLE/DISABLE LOGIC ===

//     if (updateData.status === "Start") {
//       // Rule 1: Start → enable current, disable others
//       await NetflixTicket.updateMany(
//         { ticketKey: { $ne: ticketKey.trim() } },
//         { $set: { enable: false } }
//       );
//       await NetflixTicket.updateOne(
//         { ticketKey: ticketKey.trim() },
//         { $set: { enable: true } }
//       );

//     } else if (updateData.status !== "Start" && updateData.status !== "On Hold") {
//       if (updateData.asap === false) {
//         // Rule 2: Started ticket changed → all enable true, current false
//         await NetflixTicket.updateMany({}, { $set: { enable: true } });
//         await NetflixTicket.updateOne(
//           { ticketKey: ticketKey.trim() },
//           { $set: { enable: false } }
//         );
//       } else {
//         // Fallback
//         await NetflixTicket.updateOne(
//           { ticketKey: ticketKey.trim() },
//           { $set: { enable: false } }
//         );
//         await NetflixTicket.updateMany(
//           { ticketKey: { $ne: ticketKey.trim() } },
//           { $set: { enable: true } }
//         );
//       }
//     } else if (updateData.status === "On Hold") {
//       // Rule 3: Started ticket → On Hold
//       const hasAsapTickets = await NetflixTicket.exists({ asap: true });

//       if (hasAsapTickets) {
//         // Enable ASAP tickets
//         await NetflixTicket.updateMany({ asap: true }, { $set: { enable: true } });
//         // Enable the On Hold ticket
//         await NetflixTicket.updateOne(
//           { ticketKey: ticketKey.trim() },
//           { $set: { enable: true } }
//         );
//       } else {
//         // No ASAP tickets → no change in enable states
//         console.log("No ASAP tickets found — keeping enable states unchanged.");
//       }
//     }

//     res.status(200).json({
//       success: true,
//       message: 'Ticket updated successfully in DB',
//       data: updatedTicket
//     });

//   } catch (error) {
//     console.error('⛔ DB update error:', error);

//     if (error.name === 'ValidationError') {
//       const details = {};
//       for (let key in error.errors) {
//         details[key] = error.errors[key].message;
//       }
//       return res.status(400).json({ success: false, error: 'Validation failed', details });
//     }

//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// };




// exports.updateTicketByKey_DB = async (req, res) => {
//   try {
//     const { ticketKey } = req.params;
//     const { status, startTime, endTime, SLA, asap } = req.body;

//     console.log("🔄 Updating ticket in DB:", ticketKey);

//     const existingTicket = await NetflixTicket.findOne({ ticketKey: ticketKey.trim() });

//     if (!existingTicket) {
//       return res.status(404).json({ success: false, error: 'Ticket not found' });
//     }

//     if (status === undefined && startTime === undefined && endTime === undefined && SLA === undefined && asap === undefined) {
//       return res.status(400).json({ success: false, error: 'No fields to update' });
//     }

//     const updateData = {
//       status: status ?? existingTicket.status,
//       startTime: startTime ?? existingTicket.startTime,
//       endTime: endTime ?? existingTicket.endTime,
//       SLA: SLA ?? existingTicket.SLA,
//       asap : asap ?? existingTicket.asap,
//       updateddate: new Date()
//     };

//     const updatedTicket = await NetflixTicket.findOneAndUpdate(
//       { ticketKey: ticketKey.trim() },
//       { $set: updateData },
//       { new: true, runValidators: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: 'Ticket updated successfully in DB',
//       data: updatedTicket
//     });

//   } catch (error) {
//     console.error('⛔ DB update error:', error);

//     if (error.name === 'ValidationError') {
//       const details = {};
//       for (let key in error.errors) {
//         details[key] = error.errors[key].message;
//       }
//       return res.status(400).json({ success: false, error: 'Validation failed', details });
//     }

//     res.status(500).json({ success: false, error: 'Internal server error' });
//   }
// };



exports.updateTicketByKey_Sheet = async (req, res) => {
  try {
    const { ticketKey } = req.params;
    const { status } = req.body;

    if (!ticketKey || !status) {
      return res.status(400).json({ success: false, error: 'ticketKey and status are required' });
    }

    console.log("📄 Updating Google Sheet for:", ticketKey);

    const sheetsClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: sheetsClient });

    const spreadsheetId = '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4';
    const sheetName = 'Sheet1';

    // Read ticket rows
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:H`,
    });

    const rows = sheetResponse.data.values || [];
    const rowIndex = rows.findIndex(row => row[0]?.trim() === ticketKey.trim());

    if (rowIndex === -1) {
      return res.status(404).json({ success: false, error: 'Ticket not found in Google Sheet' });
    }

    const sheetRange = `${sheetName}!H${rowIndex + 2}`; // +2 because A2 starts after header
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: sheetRange,
      valueInputOption: 'RAW',
      resource: {
        values: [[status]],
      },
    });

    console.log(`✅ Sheet updated for ${ticketKey} in range ${sheetRange}`);

    res.status(200).json({
      success: true,
      message: 'Ticket status updated in Google Sheet',
      ticketKey,
      status
    });

  } catch (error) {
    console.error('❌ Google Sheet update error:', error.response?.data || error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
};




exports.getCMs = async (req, res) => {
  try {
    // const { region } = req.query;

    // Build filter
    const filter = { role: 1 };
    // if (region) {
    //   filter.region = region;
    // }

    // Find all CMs with role=1 (and region if provided)
    const cms = await UserData.find(
      filter,
      { name: 1, emailId: 1, userId: 1, region: 1, _id: 0 } // projecting fields
    ).lean();

    return res.status(200).json({
      success: true,
      count: cms.length,
      data: cms
    });

  } catch (error) {
    console.error("Error fetching CMs:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};





exports.updateBackupCM_DB = async (req, res) => {
  try {
    const { ticketKey, userId } = req.body;

    if (!ticketKey || !userId) {
      return res.status(400).json({ message: "ticketKey and userId are required" });
    }

    // Find CM details from UserData
    const cm = await UserData.findOne({ userId }).lean();
    if (!cm) {
      return res.status(404).json({ message: "CM not found in UserData" });
    }

    // Update Netflix ticket in DB
    const updatedTicket = await NetflixTicket.findOneAndUpdate(
      { ticketKey },
      {
        CM_name: cm.name,
        backupCM_email: cm.emailId
      },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ message: "Ticket not found" });
    }

    res.json({
      message: "CM updated successfully in Database",
      ticket: updatedTicket
    });

  } catch (err) {
    console.error("Error updating backup CM in DB:", err);
    res.status(500).json({ message: "Server error" });
  }
};



exports.updateBackupCM_Sheet = async (req, res) => {
  try {
    const { ticketKey, userId } = req.body;

    if (!ticketKey || !userId) {
      return res.status(400).json({ message: "ticketKey and userId are required" });
    }

    // Find CM details from UserData
    const cm = await UserData.findOne({ userId }).lean();
    if (!cm) {
      return res.status(404).json({ message: "CM not found in UserData" });
    }

    // Google Sheets Client
    const sheetsClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: sheetsClient });

    const spreadsheetId = '1a6dhDpgyr_Bdis-CHsCfVjhwiNrwoS4_P1Im99FlLi4';
    const sheetName = 'Sheet1';

    // Read sheet (Issue key column A)
    const sheetResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A2:J`,
    });

    const rows = sheetResponse.data.values || [];
    let rowIndex = -1;

    // Find the row where Issue key = ticketKey
    for (let i = 0; i < rows.length; i++) {
      if (rows[i][0] === ticketKey) {
        rowIndex = i + 2; // because A2 is start
        break;
      }
    }

    if (rowIndex === -1) {
      return res.status(404).json({ message: "Ticket not found in Google Sheet" });
    }

    // Update CM_mail_id (column I = 9th col)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!I${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[cm.emailId]],
      },
    });

    res.json({
      message: "CM updated successfully in Google Sheet",
      ticketKey,
      backupCM_email: cm.emailId
    });

  } catch (err) {
    console.error("Error updating backup CM in Google Sheet:", err);
    res.status(500).json({ message: "Server error" });
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





