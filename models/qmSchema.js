const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter collection for atomic increments
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { 
  // Prevent versioning conflicts
  versionKey: false 
});

// Safe model definition with existing check
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// QM Schema with enhanced validation
const qmSchema = new Schema({
  qmid: { 
    type: String, 
    unique: true,
    immutable: true // Prevent modification after creation
  },
  name: { type: String, required: true },
  jiraUserId: { type: String, required: true, unique: true },
  emailId: { 
    type: String, 
    required: true,
    unique: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: props => `${props.value} is not a valid email!`
    }
  },
  region: { type: String, required: true },
  createdAt: { type: Date, default: Date.now, immutable: true },
  updatedAt: { type: Date, default: Date.now },
  role: { type: Number, required: true }
});

// Transaction-based ID generation to prevent duplicates
qmSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'qmid' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).lean();

    this.qmid = `QM-${counter.seq.toString().padStart(6, '0')}`;
    
    await session.commitTransaction();
    next();
  } catch (err) {
    await session.abortTransaction();
    
    if (err.code === 11000) {
      // Duplicate key error - retry once
      try {
        const existingCounter = await Counter.findById('qmid').session(session);
        this.qmid = `QM-${(existingCounter.seq + 1).toString().padStart(6, '0')}`;
        await Counter.findByIdAndUpdate(
          'qmid',
          { $inc: { seq: 1 } },
          { session }
        );
        await session.commitTransaction();
        next();
      } catch (retryErr) {
        await session.abortTransaction();
        next(retryErr);
      }
    } else {
      next(err);
    }
  } finally {
    session.endSession();
  }
});

// Create compound index
qmSchema.index({ qmid: 1, emailId: 1 }, { unique: true });

// Export model with overwrite protection
module.exports = mongoose.models.QM || mongoose.model('QM', qmSchema);