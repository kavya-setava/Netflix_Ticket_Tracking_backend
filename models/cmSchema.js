const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter collection for atomic increments
const counterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
}, { 
  versionKey: false // Prevent versioning conflicts
});

// Safe model definition with existing check
const Counter = mongoose.models.Counter || mongoose.model('Counter', counterSchema);

// CM Schema with enhanced validation
const cmSchema = new Schema({
  cmid: { 
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
cmSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'cmid' }, // Different ID from QM counter
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).lean();

    this.cmid = `CM-${counter.seq.toString().padStart(6, '0')}`;
    
    await session.commitTransaction();
    next();
  } catch (err) {
    await session.abortTransaction();
    
    if (err.code === 11000) {
      // Duplicate key error - retry once
      try {
        const existingCounter = await Counter.findById('cmid').session(session);
        this.cmid = `CM-${(existingCounter.seq + 1).toString().padStart(6, '0')}`;
        await Counter.findByIdAndUpdate(
          'cmid',
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
cmSchema.index({ cmid: 1, emailId: 1 }, { unique: true });

// Export model with overwrite protection
module.exports = mongoose.models.CM || mongoose.model('CM', cmSchema);