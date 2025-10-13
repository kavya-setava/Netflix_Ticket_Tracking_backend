
// // socket/notifications.js
// const Ticket = require('../models/netflixUpdateSchema');

// const clients = new Map(); // email → ws connection

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
//     clients.set(backupEmail, ws);

//     // ✅ On connect — send all existing ASAP tickets
//     try {
//       const asapTickets = await Ticket.find({
//         backupCM_email: backupEmail,
//         asap: true
//       }).select('ticketKey backupCM_email updated created status asap');

//       if (asapTickets.length > 0) {
//         for (const ticket of asapTickets) {
//           ws.send(JSON.stringify({ type: 'ticket', data: ticket }));
//         }
//       } else {
//         ws.send(JSON.stringify({ type: 'noTickets', message: 'No ASAP tickets found' }));
//       }
//     } catch (err) {
//       console.error('❌ Error fetching tickets:', err.message);
//       ws.send(JSON.stringify({ error: 'Error fetching ASAP tickets' }));
//     }

//     ws.on('close', () => {
//       console.log(`🔴 Disconnected: ${backupEmail}`);
//       clients.delete(backupEmail);
//     });
//   });
// };

// ✅ Export function so your PUT API can push updates
// module.exports.sendAsapNotification = async (backupEmail, ticketData) => {
//   const ws = clients.get(backupEmail);
//   if (ws && ws.readyState === ws.OPEN) {
//     ws.send(JSON.stringify({ type: 'ticket', data: ticketData }));
//     console.log(`📩 Sent new ASAP notification to ${backupEmail}`);
//   } else {
//     console.log(`⚠️ No active WebSocket for ${backupEmail}`);
//   }
// };


// const Ticket = require('../models/netflixUpdateSchema');

// // ✅ Store multiple connections per email
// const clients = new Map(); // email → Set of ws connections

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

//     // ✅ Add this connection to the Set for this email
//     if (!clients.has(backupEmail)) {
//       clients.set(backupEmail, new Set());
//     }
//     clients.get(backupEmail).add(ws);

//     console.log(`🟢 WebSocket connected for ${backupEmail} (total: ${clients.get(backupEmail).size})`);

//     // ✅ Send existing ASAP tickets to this specific connection
//     try {
//       const asapTickets = await Ticket.find({
//         backupCM_email: backupEmail,
//         asap: true
//       }).select('ticketKey backupCM_email updated created status asap');

//       if (asapTickets.length > 0) {
//         for (const ticket of asapTickets) {
//           ws.send(JSON.stringify({ type: 'ticket', data: ticket }));
//         }
//       } else {
//         ws.send(JSON.stringify({ type: 'noTickets', message: 'No ASAP tickets found' }));
//       }
//     } catch (err) {
//       console.error('❌ Error fetching tickets:', err.message);
//       ws.send(JSON.stringify({ error: 'Error fetching ASAP tickets' }));
//     }

//     ws.on('close', () => {
//       console.log(`🔴 Disconnected: ${backupEmail}`);
//       const emailClients = clients.get(backupEmail);
//       if (emailClients) {
//         emailClients.delete(ws);
//         // Clean up empty Sets
//         if (emailClients.size === 0) {
//           clients.delete(backupEmail);
//         }
//       }
//     });

//     ws.on('error', (error) => {
//       console.error(`❌ WebSocket error for ${backupEmail}:`, error.message);
//     });
//   });
// };

// // ✅ Send notification to ALL connections with this email
// module.exports.sendAsapNotification = async (backupEmail, ticketData) => {
//   const emailClients = clients.get(backupEmail);
  
//   if (!emailClients || emailClients.size === 0) {
//     console.log(`⚠️ No active WebSocket for ${backupEmail}`);
//     return;
//   }

//   let successCount = 0;
//   let failCount = 0;

//   emailClients.forEach((ws) => {
//     if (ws.readyState === ws.OPEN) {
//       ws.send(JSON.stringify({ type: 'ticket', data: ticketData }));
//       successCount++;
//     } else {
//       failCount++;
//       // Clean up dead connections
//       emailClients.delete(ws);
//     }
//   });

//   console.log(`📩 Sent ASAP notification to ${backupEmail}: ${successCount} delivered, ${failCount} failed`);
// };


const Ticket = require('../models/netflixUpdateSchema');

// ✅ Store multiple connections per email
const clients = new Map(); // email → Set of ws connections

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

    // Add this connection to the Set for this email
    if (!clients.has(backupEmail)) {
      clients.set(backupEmail, new Set());
    }
    clients.get(backupEmail).add(ws);

    console.log(`🟢 WebSocket connected for ${backupEmail} (total: ${clients.get(backupEmail).size})`);

    // Send existing ASAP tickets to this specific connection
    try {
      const asapTickets = await Ticket.find({
        backupCM_email: backupEmail,
        asap: true,
        notify: true // ✅ Only send tickets that still need notification
      }).select('ticketKey backupCM_email updated created status asap');

      if (asapTickets.length > 0) {
        for (const ticket of asapTickets) {
          ws.send(JSON.stringify({ type: 'ticket', data: ticket }));

          // ✅ Reset notify to false after sending
          try {
            await Ticket.findByIdAndUpdate(ticket._id, { $set: { notify: false } });
          } catch (err) {
            console.error(`❌ Failed to reset notify for ticket ${ticket.ticketKey}:`, err.message);
          }
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
      const emailClients = clients.get(backupEmail);
      if (emailClients) {
        emailClients.delete(ws);
        if (emailClients.size === 0) clients.delete(backupEmail);
      }
    });

    ws.on('error', (error) => {
      console.error(`❌ WebSocket error for ${backupEmail}:`, error.message);
    });
  });
};

// ✅ Send notification to ALL connections with this email
module.exports.sendAsapNotification = async (backupEmail, ticketData) => {
  const emailClients = clients.get(backupEmail);
  
  if (!emailClients || emailClients.size === 0) {
    console.log(`⚠️ No active WebSocket for ${backupEmail}`);
    return;
  }

  let successCount = 0;
  let failCount = 0;

  emailClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ticket', data: ticketData }));
      successCount++;
    } else {
      failCount++;
      emailClients.delete(ws);
    }
  });

  console.log(`📩 Sent ASAP notification to ${backupEmail}: ${successCount} delivered, ${failCount} failed`);

  // ✅ Reset notify flag after sending
  try {
    await Ticket.findByIdAndUpdate(ticketData._id, { $set: { notify: false } });
    console.log(`📝 Ticket ${ticketData.ticketKey} notify reset to false`);
  } catch (err) {
    console.error(`❌ Failed to reset notify for ticket ${ticketData.ticketKey}:`, err.message);
  }
};
