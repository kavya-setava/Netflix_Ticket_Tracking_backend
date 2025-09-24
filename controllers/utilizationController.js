const ticketActivity = require("../models/utilizationSchema");

// Helper Functions
const hmsToSeconds = (hms) => {
  const [h, m, s] = hms.split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

const secondsToHMS = (seconds) => {
  const h = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const m = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");

  return `${h}:${m}:${s}`;
};

exports.updateTicketActivity = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { status, timestamp, deadline } =
      req.body;

      if (!status || !timestamp) {
        return res
          .status(400)
          .json({ success: false, error: "status and timeStamp are required" });
      }

    let ticketData = await ticketActivity.findOne({ ticketId });

    if(!ticketData){
        if (status !== "Start") {
            return res.status(400).json({
              success: false,
              error: "Ticket must be started before changing status",
            });
          }


        ticketData = new ticketActivity({
            ticketId,
            deadline : deadline,
            totalDuration : "00:00:00",
            sessions : []
        })
    }

    const lastSession = ticketData.sessions.length > 0 ? ticketData.sessions[ticketData.sessions.length - 1] : null

    if(status === "Start"){
        if (lastSession && !lastSession.endedAt) {
            return res.status(400).json({
              success: false,
              error: "Ticket already started. End current session before restarting",
            });
          }

        ticketData.sessions.push({startedAt : timestamp, statusAtEnd:null})
        ticketData.status = "Start"
    } else if (["Need More Information", "Interim", "Sent to VAO", "Solution Provided", "Closed", "On Hold"].includes(status)){
        if(!lastSession || lastSession.endedAt){
            return res.status(400).json({
                success: false,
                error: "Invalid Status, previous session has already ended",
              });
        }

        if(lastSession && !lastSession.endedAt){
            lastSession.endedAt = timestamp,
            lastSession.statusAtEnd = status

            const sessionSeconds = Math.floor((new Date(lastSession.endedAt) - new Date(lastSession.startedAt)) / 1000)

            const prevTotal = hmsToSeconds(ticketData.totalDuration)
            ticketData.totalDuration = secondsToHMS(prevTotal+sessionSeconds)
        }
        ticketData.status = status
    } else {
        return res.status(400).json({success : false, error : "Invalid Status"})
    }

    if(["Need More Information", "Sent to VAO", "Solution Provided", "Closed"].includes(status)){
        ticketData.completed_within_SLA = ticketData.deadline && new Date(timestamp) <= new Date(ticketData.deadline)
    }

    await ticketData.save();

    res.json({
        success : true,
        ticketData
    })

  } catch (error) {
    console.error("Error in updateTicketActivity:", error);
    res
      .status(500)
      .json({ success: false, error: "Error in updating ticket activity" });
  }
};
