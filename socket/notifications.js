// const Ticket = require('../models/netflixUpdateSchema'); // adjust path

// module.exports = (io) => {
//   io.on('connection', async (socket) => {
//     // ✅ Get backup email from query params
//     const backupEmail = socket.handshake.query.backupEmail;

//     console.log('🟢 User connected:', socket.id, '📩 Email:', backupEmail);

//     if (!backupEmail) {
//       console.log('⚠️ No backupEmail provided in WebSocket connection');
//       socket.emit('error', { message: 'backupEmail is required in query params' });
//       return;
//     }

//     try {
//       // ✅ Step 1: Fetch ASAP tickets for this user
//       const asapTickets = await Ticket.find({
//         backupCM_email: backupEmail,
//         asap: true
//       }).select('ticketKey backupCM_email updated created status');

//       // ✅ Step 2: Send tickets back to that specific user
//       socket.emit('asapTickets', asapTickets);
//     } catch (error) {
//       console.error('❌ Error fetching ASAP tickets:', error.message);
//       socket.emit('error', { message: 'Error fetching ASAP tickets' });
//     }

//     socket.on('disconnect', () => {
//       console.log('🔴 User disconnected:', socket.id);
//     });
//   });
// };



// socket/notifications.js
// const Ticket = require('../models/netflixUpdateSchema');

// module.exports = (wss) => {
//   console.log("🧩 WebSocket server ready on /asapnoti");

//   wss.on('connection', async (ws, req) => {
//     const params = new URLSearchParams(req.url.split('?')[1]);
//     const backupEmail = params.get('backupEmail');

//     if (!backupEmail) {
//       ws.send(JSON.stringify({ error: '❌ backupEmail is required in query params' }));
//       ws.close();
//       return;
//     }

//     console.log(`🟢 WebSocket connected for ${backupEmail}`);

//     try {
//       // ✅ Find tickets with asap=true for this user
//       const asapTickets = await Ticket.find({
//         backupCM_email: backupEmail,
//         asap: true
//       }).select('ticketKey backupCM_email updated created status');

//       if (asapTickets.length > 0) {
//         asapTickets.forEach(ticket => {
//           ws.send(JSON.stringify({ type: 'ticket', data: ticket }));
//         });
//       } else {
//         ws.send(JSON.stringify({ type: 'noTickets', message: 'No ASAP tickets found' }));
//       }

//     } catch (err) {
//       console.error('❌ Error fetching tickets:', err.message);
//       ws.send(JSON.stringify({ error: 'Error fetching ASAP tickets' }));
//     }

//     ws.on('close', () => {
//       console.log(`🔴 Connection closed for ${backupEmail}`);
//     });
//   });
// };


// socket/notifications.js
const Ticket = require('../models/netflixUpdateSchema');

const clients = new Map(); // email → ws connection

module.exports = (wss) => {
  console.log("🧩 WebSocket server ready on /asapnoti");

  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const backupEmail = params.get('backupEmail');

    if (!backupEmail) {
      ws.send(JSON.stringify({ error: '❌ backupEmail is required in query params' }));
      ws.close();
      return;
    }

    console.log(`🟢 WebSocket connected for ${backupEmail}`);
    clients.set(backupEmail, ws);

    // ✅ On connect — send all existing ASAP tickets
    try {
      const asapTickets = await Ticket.find({
        backupCM_email: backupEmail,
        asap: true
      }).select('ticketKey backupCM_email updated created status asap');

      if (asapTickets.length > 0) {
        for (const ticket of asapTickets) {
          ws.send(JSON.stringify({ type: 'ticket', data: ticket }));
        }
      } else {
        ws.send(JSON.stringify({ type: 'noTickets', message: 'No ASAP tickets found' }));
      }
    } catch (err) {
      console.error('❌ Error fetching tickets:', err.message);
      ws.send(JSON.stringify({ error: 'Error fetching ASAP tickets' }));
    }

    ws.on('close', () => {
      console.log(`🔴 Disconnected: ${backupEmail}`);
      clients.delete(backupEmail);
    });
  });
};

// ✅ Export function so your PUT API can push updates
module.exports.sendAsapNotification = async (backupEmail, ticketData) => {
  const ws = clients.get(backupEmail);
  if (ws && ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify({ type: 'ticket', data: ticketData }));
    console.log(`📩 Sent new ASAP notification to ${backupEmail}`);
  } else {
    console.log(`⚠️ No active WebSocket for ${backupEmail}`);
  }
};
