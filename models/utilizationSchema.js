const mongoose = require('mongoose');

const ticketActivitySchema = new mongoose.Schema({
    ticketId : {type : String, required: true, unique: true},
    status : {type : String, enum : ["Start", "Interim", "Need More Information", "Sent to VAO", "Solution Provided", "Closed", "On Hold"]},
    deadline : {type : String},
    completed_within_SLA : {type:Boolean, default:null},
    totalDuration : {type : String, default : "00:00:00"},
    sessions : [
        {
            startedAt : {type : String},
            endedAt : {type : String},
            statusAtEnd : {type : String}
        }
    ]
});

module.exports = mongoose.model("ticketActivity", ticketActivitySchema);