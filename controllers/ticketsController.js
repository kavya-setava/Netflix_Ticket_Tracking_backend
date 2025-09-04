const Task = require("../models/taskSubtaskSchema");
const NetflixTicket = require("../models/netflixUpdateSchema");


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
         
          taskId:task.taskId || " "
        }
      },
      { new: true }
    );

    if (!updatedTicket) {
      return res.status(404).json({ error: "Ticket not found" });
    }

    res.json({
      message: "Ticket updated successfully",
      ticket: updatedTicket
    });

  } catch (err) {
    console.error("Error updating ticket taskType:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
};
