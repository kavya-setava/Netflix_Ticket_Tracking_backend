const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter for auto-incrementing IDs
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
// const Counter = mongoose.model('Counter', CounterSchema);
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

// Main Schema
const NetflixTicketsSchema = new Schema({
  ticketID: {
    type: String,
    
  },
  ticketKey: {
    type: String,
  },
  // created: String,
  // updated: String,
  created: {
  type: String,
 
},
updated: {
  type: String,
 
},
  CM_name: {
    type: String,
  },
  CM_email: {
    type: String,
    match: [/.+\@.+\..+/, 'Please fill a valid email address']
  },
  cm_region: {
    type: String,
    // enum: ['', 'NA', 'EMEA', 'APAC', 'LATAM', 'UCAN'],
    default: ''
  },
  AM_name: {
    type: String,
    default: ''
  },
  SLA: {
    type: String,  // Changed to String (default empty)
    default: "00:00:00"
  },
 
  latest_created_date: {
    type: Date,
    default: Date.now
  },
  startTime: {
    type: String,
    default: '00:00:00'
  },
  endTime: {
    type: String,
    default: '00:00:00'
  },
   pauseTime: {
    type: String,
    default: '00:00:00'
  },
  status: {
    type: String,
    default: ''
  }, 
  updateddate: {
    type: Date,
    default: Date.now
  }
});

// Auto-generate ticketID before saving
NetflixTicketsSchema.pre('save', async function(next) {
  if (!this.isNew) return next();
  
  try {
    const counter = await Counter.findByIdAndUpdate(
      { _id: 'ticketId' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    this.ticketID = `NTT-${String(counter.seq).padStart(6, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});


// module.exports = mongoose.model('NetflixTicket', NetflixTicketsSchema);
const NetflixTicket = mongoose.models.NetflixTicket || mongoose.model('NetflixTicket', NetflixTicketsSchema);
module.exports = NetflixTicket;