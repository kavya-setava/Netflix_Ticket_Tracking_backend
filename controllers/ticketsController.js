const Task = require("../models/taskSubtaskSchema");
const NetflixTicket = require('../models/Netflixupdateschema');
const UserData = require("../models/UserSchema");



// Create Task Controller
exports.createTask = async (req, res) => {
  try {
    const { taskType, subTaskType } = req.body;
    console.log('req.body',req.body);
    

   if (!taskType || taskType.trim() === "") {
      return res.status(400).json({ error: "taskType is required" });
    }


    const newTask = new Task({
      taskType,
      subTaskType
    });

    await newTask.save();

    res.status(201).json({
      message: "Task created successfully",
      task: newTask
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: "This Task + SubTask combination already exists" });
    }
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};





// GET API for dropdown

exports.getTaskDropdown = async (req, res) => {
  try {
    // Get all tasks
    const tasks = await Task.find({}, "taskId taskType subTaskType").lean();

    // Format response with fixed key
    const formatted = tasks.map(task => ({
      taskType: task.taskType,
      subTaskType: task.subTaskType || "",
      taskId: task.taskId
    }));

    res.json(formatted);
  } catch (err) {
    console.error("Error fetching dropdown data:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};


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


function getCurrentIST() {
  return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));
}

// Update Ticket's TaskType & SubTaskType
exports.updateTicketTask = async (req, res) => {
  try {
    const { ticketKey, taskId } = req.body;

    if (!ticketKey || !taskId) {
      return res.status(400).json({ error: "ticketKey and taskId are required" });
    }

    // 1. Find the task
    const task = await Task.findOne({ taskId });
    
    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 2. Update the ticket
    const updatedTicket = await NetflixTicket.findOneAndUpdate(
      { ticketKey },
      {
        $set: {
          taskType: task.taskType || "",
          subTaskType: task.subTaskType || ""
          
        }
      },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    const currentIST = getCurrentIST();
    const userEmail = updatedTicket.backupCM_email || updatedTicket.CM_email;
    const userForSLA = await UserData.findOne({ emailId: userEmail }).lean();

    const slaData = calculateSLA(updatedTicket, userForSLA, currentIST);

    // 4. Save SLA into the ticket
    updatedTicket.slaData = slaData;
    await updatedTicket.save();

    res.json({
      message: "Ticket updated successfully",
      ticket: updatedTicket
    });

  } catch (err) {
    console.error("Error updating ticket taskType:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};




// Update shift timings for all EMEA users
exports.updateEmeaShiftTiming = async (req, res) => {
  try {
    const { shiftStart, shiftEnd } = req.body;

    if (!shiftStart || !shiftEnd) {
      return res.status(400).json({ message: "shiftStart and shiftEnd are required" });
    }

    // Update all users in EMEA region
    const result = await UserData.updateMany(
      { region: "UCAN" },
      { 
        $set: { 
          shiftStart,
          shiftEnd,
          updatedAt: Date.now()
        }
      }
    );

    res.status(200).json({
      message: "Shift timings updated for EMEA users",
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error("Error updating EMEA shift timings:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
