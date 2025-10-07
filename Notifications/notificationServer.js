const express = require('express')
const http = require('http')
const WebSocket  = require('ws')
const url = require('url')
const cors = require('cors')
const ticketRoutes = require('../routes/netflixGetAllData')

const app = express()

app.use(cors())
app.use(express.json())
app.use("/api", ticketRoutes);

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server, path: "/api/asapNotification" });

// Store connections mapped by CM email
const cmConnections = new Map();

wss.on("connection", (ws, req) => {
  const parameters = url.parse(req.url, true);
  const cmEmail = parameters.query.email;

  if (!cmEmail) {
    console.warn("Connection rejected — CM email missing");
    ws.close();
    return;
  }

  console.log(`✅ CM connected: ${cmEmail}`);
  cmConnections.set(cmEmail, ws);

  ws.on("close", () => {
    console.log(`❌ CM disconnected: ${cmEmail}`);
    cmConnections.delete(cmEmail);
  });
});

// Function to send notification to specific CM
const notifyCM = (cmEmail, message) => {
  const ws = cmConnections.get(cmEmail);
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({ message }));
    console.log(`📨 Sent notification to ${cmEmail}`);
  } else {
    console.warn(`⚠️ CM ${cmEmail} not connected`);
  }
};

// Export for use in controllers
module.exports = { server, notifyCM };

// Start the server
const PORT = 5000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));


