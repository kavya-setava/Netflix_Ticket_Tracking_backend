
const mongoose = require('mongoose');


require('dotenv').config();


const dbURI = process.env.MONGO_URI || 'mongodb://localhost:27017/your-database-name'; // Default to local DB if not in .env

const connectDB = async () => {
    try {
      await mongoose.connect(dbURI);  // Removed the deprecated options
      console.log('MongoDB connected successfully');
    } catch (err) {
      console.error('Error connecting to MongoDB:', err.message);
      process.exit(1);  // Exit process with failure
    }
  };
  

module.exports = connectDB;
