// models/cmSchema.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter collection for auto-incrementing CMID
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// CM Schema
const cmSchema = new Schema({
  cmid: { type: String, unique: true },
  name: String,
  jiraUserId: String,
  emailId: String,
  region: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  role: Number
});

// Auto-increment cmid before saving
cmSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }
  
  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'cmid' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    this.cmid = `CM-${counter.seq.toString().padStart(6, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('CM', cmSchema);