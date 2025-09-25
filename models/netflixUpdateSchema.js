const mongoose = require('mongoose');
const { Schema } = mongoose;

// Counter for auto-incrementing IDs
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});
const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

// Main Schema
const NetflixTicketsSchema = new Schema({
  ticketID: {
    type: String,
  },
  ticketKey: {
    type: String,
  },
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
  },
  backupCM_email: { type: String, default: '' },
  cm_region: {
    type: String,
    default: ''
  },
  AM_name: {
    type: String,
    default: ''
  },
  SLA: {
    type: String,
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
  },
  startDateTime: {
    type: String,
    default: ""
  },
  endDateTime: {
    type: String,
    default: ""
  },
  deadlineDateTime: {
    type: String,
    default: ""
  },
  taskType: {
    type: String,
    default: ""
  },
  subTaskType: {
    type: String,
    default: ""
  },
  asap:{
    type:Boolean,
    default:false
  },
  enabe:{
     type:Boolean,
    default:true
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

// CORRECTED: Add indexes to NetflixTicketsSchema (not NetflixTicketSchema)
NetflixTicketsSchema.index({ CM_email: 1 });
NetflixTicketsSchema.index({ updated: -1 });
NetflixTicketsSchema.index({ status: 1 });
NetflixTicketsSchema.index({ cm_region: 1 });
NetflixTicketsSchema.index({ created: 1 });
NetflixTicketsSchema.index({ ticketID: 1 });
NetflixTicketsSchema.index({ ticketKey: 1 });
NetflixTicketsSchema.index({ status: 1, updated: -1 }); // Compound index
NetflixTicketsSchema.index({ backupCM_email: 1 });
NetflixTicketsSchema.index({ CM_email: 1, backupCM_email: 1 }); // Compound index
NetflixTicketsSchema.index({ backupCM_email: 1, updated: -1 }); // Compound index
// Add these compound indexes to significantly improve query performance
NetflixTicketsSchema.index({ 
  status: 1, 
  asap: 1, 
  updated: -1 
});

NetflixTicketsSchema.index({ 
  backupCM_email: 1, 
  status: 1, 
  updated: -1 
});

NetflixTicketsSchema.index({ 
  CM_email: 1, 
  status: 1, 
  updated: -1 
});

// For region-based queries
NetflixTicketsSchema.index({ 
  cm_region: 1, 
  status: 1, 
  updated: -1 
});
const NetflixTicket = mongoose.models.NetflixTicket || mongoose.model('NetflixTicket', NetflixTicketsSchema);
module.exports = NetflixTicket;