const mongoose = require('mongoose');

const userDataSchema = new mongoose.Schema({
  userId: {
    type: String,
    unique: true,
    immutable: true
  },
  name: { 
    type: String, 
    required: true 
  },
  jiraUserId: { 
    type: String, 
    unique: true 
  },
  emailId: {
    type: String,
    required: true,
    unique: true,
    validate: {
      validator: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      message: props => `${props.value} is not a valid email!`
    }
  },
  region: { 
    type: String
  },
  createdAt: { 
    type: Date, 
    default: Date.now, 
    immutable: true 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  },
  role: { 
    type: Number
   
  }
}, {
  collection: 'userdata'
});

// ID generation middleware
userDataSchema.pre('save', async function(next) {
  if (!this.isNew) {
    this.updatedAt = Date.now();
    return next();
  }

  const Counter = mongoose.models.Counter || mongoose.model('Counter', new mongoose.Schema({
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 }
  }, { versionKey: false }));

  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const counter = await Counter.findOneAndUpdate(
      { _id: 'userId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true, session }
    ).lean();

    this.userId = `User-${counter.seq.toString().padStart(6, '0')}`;
    
    await session.commitTransaction();
    next();
  } catch (err) {
    await session.abortTransaction();
    next(err);
  } finally {
    session.endSession();
  }
});

module.exports = mongoose.models.UserData || mongoose.model('UserData', userDataSchema);