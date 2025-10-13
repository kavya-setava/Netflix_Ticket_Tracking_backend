
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

// // ✅ Export function so your PUT API can push updates
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



require('dotenv').config();
const redis = require('redis');
const Ticket = require('../models/netflixUpdateSchema');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

const publisher = redis.createClient({ 
  url: REDIS_URL,
  socket: {
    connectTimeout: 10000, // 10 seconds
    reconnectStrategy: (retries) => {
      if (retries > 10) {
        console.error('❌ Redis: Too many retries, giving up');
        return new Error('Too many retries');
      }
      const delay = Math.min(retries * 100, 3000);
      console.log(`🔄 Redis: Reconnecting in ${delay}ms... (attempt ${retries})`);
      return delay;
    }
  }
});

const subscriber = redis.createClient({ 
  url: REDIS_URL,
  socket: {
    connectTimeout: 10000,
    reconnectStrategy: (retries) => {
      if (retries > 10) return new Error('Too many retries');
      return Math.min(retries * 100, 3000);
    }
  }
});

// Error handlers
publisher.on('error', (err) => {
  console.error('❌ Redis Publisher Error:', err.message);
});

subscriber.on('error', (err) => {
  console.error('❌ Redis Subscriber Error:', err.message);
});

// Connect with better error handling
(async () => {
  try {
    console.log('🔄 Connecting to Redis:', REDIS_URL);
    await publisher.connect();
    await subscriber.connect();
    console.log('✅ Redis connected successfully to:', REDIS_URL);
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
    console.error('💡 Make sure Redis is running and accessible');
    // Don't crash the app, just log the error
  }
})();

const clients = new Map();
const CHANNEL = 'asap-notifications';

module.exports = (wss) => {
  console.log("🧩 WebSocket server ready on /asapnoti");

  // Only subscribe if connected
  if (subscriber.isOpen) {
    subscriber.subscribe(CHANNEL, (message) => {
      const { backupEmail, ticketData } = JSON.parse(message);
      sendToLocalClients(backupEmail, ticketData);
    });
  }

  wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const backupEmail = params.get('backupEmail');

    if (!backupEmail) {
      ws.send(JSON.stringify({ error: '❌ backupEmail is required' }));
      ws.close();
      return;
    }

    if (!clients.has(backupEmail)) {
      clients.set(backupEmail, new Set());
    }
    clients.get(backupEmail).add(ws);

    console.log(`🟢 Connected: ${backupEmail} (total: ${clients.get(backupEmail).size})`);

    try {
      const asapTickets = await Ticket.find({
        backupCM_email: backupEmail,
        asap: true
      }).select('ticketKey backupCM_email updated created status asap');

      if (asapTickets.length > 0) {
        asapTickets.forEach(ticket => {
          ws.send(JSON.stringify({ type: 'ticket', data: ticket }));
        });
      } else {
        ws.send(JSON.stringify({ type: 'noTickets', message: 'No ASAP tickets' }));
      }
    } catch (err) {
      console.error('❌ Error:', err.message);
      ws.send(JSON.stringify({ error: 'Error fetching tickets' }));
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

module.exports.sendAsapNotification = async (backupEmail, ticketData) => {
  // Check if publisher is connected
  if (!publisher.isOpen) {
    console.error('❌ Redis not connected, cannot send notification');
    return;
  }

  try {
    await publisher.publish(CHANNEL, JSON.stringify({ backupEmail, ticketData }));
    console.log(`📡 Published notification for ${backupEmail} to Redis`);
  } catch (err) {
    console.error('❌ Redis publish error:', err.message);
  }
};

function sendToLocalClients(backupEmail, ticketData) {
  const emailClients = clients.get(backupEmail);
  
  if (!emailClients || emailClients.size === 0) {
    console.log(`⚠️ No local clients for ${backupEmail}`);
    return;
  }

  let successCount = 0;
  emailClients.forEach((ws) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'ticket', data: ticketData }));
      successCount++;
    } else {
      emailClients.delete(ws);
    }
  });

  console.log(`📩 Sent to ${successCount} local client(s) for ${backupEmail}`);
}