// const express = require('express');
// const dotenv = require('dotenv');
// const cors = require('cors'); 
// const http = require('http');
// const { Server } = require('socket.io');
// const app = express();
// const connectDB = require('./DataBase/db');
// const netflixRoutes = require('./routes/netflixGetAllData.js'); // adjust path as needed
// const authRoutes = require('./routes/authRoute.js')
// //const route = require('./routes/indexRoute');
// const { migrateData } = require('./scripts/excelDataToDb.js');
// const cron = require('node-cron');
// const taskRoutes = require("./routes/taskType.js");
// const utilizationRoutes = require("./routes/utilizationRoutes.js");


// dotenv.config();
// connectDB();




// app.use(cors({
//   origin: ['http://localhost:4200','http://localhost:5173'],
//   methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
//   credentials: true 
// }));

// app.use(express.json());
// // app.use('/api', route);
// app.use('/api', netflixRoutes); 
// app.use("/api/tasks", taskRoutes);
// app.use("/api", utilizationRoutes);

// app.use('/api/google', authRoutes);

// // cron.schedule('*/5 * * * * ', async () => {
// //   console.log(`\n🕐 Cron Job started at ${new Date().toLocaleString()}`);
// //   await migrateData();
// // });


// app.get('/', (req, res) => {
//   res.send("🎬 Netflix Ticketing Backend Running");
// });

// // ✅ Create HTTP server (required for Socket.IO)
// const server = http.createServer(app);

// // ✅ Create Socket.IO instance
// const io = new Server(server, {
//   cors: {
//     origin: ['http://localhost:4200','http://localhost:5173'],
//     methods: ['GET', 'POST']
//   },
//   path: "/asapnoti" // 👈 your custom socket endpoint
// });

// // ✅ Initialize WebSocket Logic
// require('./socket/notifications.js')(io);

// // ✅ Start server
// const port = process.env.PORT || 3000;
// server.listen(port, () => {
//   console.log(`Server running at http://localhost:${port}`);
// });




// app.js
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const http = require('http');
const { WebSocketServer } = require('ws'); // ✅ use native ws
const connectDB = require('./DataBase/db');
const netflixRoutes = require('./routes/netflixGetAllData.js');
const authRoutes = require('./routes/authRoute.js');
const taskRoutes = require('./routes/taskType.js');
const utilizationRoutes = require('./routes/utilizationRoutes.js');

dotenv.config();
connectDB();

const app = express();
app.use(cors({
  origin: ['http://localhost:4200','http://localhost:5173'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true 
}));
app.use(express.json());

app.use('/api', netflixRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api', utilizationRoutes);
app.use('/api/google', authRoutes);

app.get('/', (req, res) => {
  res.send("🎬 Netflix Ticketing Backend Running");
});

// ✅ Create HTTP server
const server = http.createServer(app);

// ✅ Create WebSocket server (native)
const wss = new WebSocketServer({ server, path: "/asapnoti" });

// ✅ Initialize your WebSocket logic (in separate file)
require('./socket/notifications')(wss);

const port = process.env.PORT || 5000;
server.listen(port, () => console.log(`🚀 Server running at http://localhost:${port}`));


