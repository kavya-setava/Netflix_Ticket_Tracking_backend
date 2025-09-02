const mongoose = require("mongoose");

// Counter schema for auto-increment taskId
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // will store "taskId"
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.model("Counter", counterSchema);

const taskSchema = new mongoose.Schema(
  {
    taskId: {
      type: String,
      unique: true
    },
    taskType: {
      type: String,
      required: true
    },
    subTaskType: {
      type: String,
      required: true
    },
    sla: {
      type: String,
      required: true
    },
    slaInMinutes: {
      type: Number,
      required: true
    }
  },
  { timestamps: true }
);

// Prevent duplicates (taskType + subTaskType must be unique)
taskSchema.index({ taskType: 1, subTaskType: 1 }, { unique: true });

// Pre-save hook to auto-generate taskId
taskSchema.pre("save", async function (next) {
  if (this.isNew) {
    const counter = await Counter.findByIdAndUpdate(
      { _id: "taskId" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const formattedId = counter.seq.toString().padStart(6, "0");
    this.taskId = `TSKID-${formattedId}`;
  }
  next();
});

const Task = mongoose.model("Task", taskSchema);

module.exports = Task;
