const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 
const app = express();
const connectDB = require('./DataBase/db');
const netflixRoutes = require('./routes/netflixGetAllData.js'); // adjust path as needed
const authRoutes = require('./routes/authRoute.js')
//const route = require('./routes/indexRoute');
const { migrateData } = require('./scripts/excelDataToDb.js');
const cron = require('node-cron');

dotenv.config();
connectDB();




app.use(cors({
  origin: ['http://localhost:4200','http://localhost:5173'],
  methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
  credentials: true 
}));

app.use(express.json());
// app.use('/api', route);
app.use('/api', netflixRoutes); 

app.use('/api/google', authRoutes);

// cron.schedule('*/3 * * * * ', async () => {
//   console.log(`\n🕐 Cron Job started at ${new Date().toLocaleString()}`);
//   await migrateData();
// });


app.get('/', (req, res) => {
  res.send("🎬 Netflix Ticketing Backend Running");
});


const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
