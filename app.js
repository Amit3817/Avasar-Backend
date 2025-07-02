import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
dotenv.config();
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a write stream (in append mode) for server.log
const logStream = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Setup morgan to log all requests to server.log
app.use(morgan('combined', { stream: logStream }));

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);

// Error-handling middleware
app.use((err, req, res, next) => {
  const errorMsg = `[${new Date().toISOString()}] ERROR: ${err.stack || err}\n`;
  logStream.write(errorMsg);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Add this at the end of the file
process.on('uncaughtException', (err) => {
  const errorMsg = `[${new Date().toISOString()}] UNCAUGHT EXCEPTION: ${err.stack || err}\n`;
  logStream.write(errorMsg);
  process.exit(1); // Optional: exit process
});

process.on('unhandledRejection', (reason) => {
  const errorMsg = `[${new Date().toISOString()}] UNHANDLED REJECTION: ${reason.stack || reason}\n`;
  logStream.write(errorMsg);
}); 