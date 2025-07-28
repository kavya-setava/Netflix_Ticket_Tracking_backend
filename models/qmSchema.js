const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter collection for auto-incrementing QMID
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.model('Counter', counterSchema);

// QM Schema
const qmSchema = new Schema({
  qmid: { type: String, unique: true },
  name: String,
  jiraUserId: String,
  emailId: String,
  region: String,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  role:Number
});

// Auto-increment qmid before saving
qmSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }
  
  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'qmid' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    
    this.qmid = `QM-${counter.seq.toString().padStart(6, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

module.exports = mongoose.model('QM', qmSchema);