import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import morgan from 'morgan';
import cron from 'node-cron';
import User from './models/User.js';
import mongoSanitize from 'express-mongo-sanitize';
import { generalLimiter } from './middleware/rateLimiter.js';
import { 
  helmetConfig, 
  slowDownConfig, 
  requestSizeLimit, 
  securityHeaders, 
  securityLogging 
} from './middleware/security.js';
import swaggerUi from 'swagger-ui-express';
import swaggerSpecs from './config/swagger.js';
dotenv.config();
import { fileURLToPath } from 'url';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
import withdrawalRoutes from './routes/withdrawal.js';
import logger from './config/logger.js';

const app = express();

// Security middleware (apply early)
app.use(helmetConfig);
app.use(securityHeaders);
app.use(requestSizeLimit);
app.use(securityLogging);

// Basic middleware
app.use(cors({
  origin: true, // Allow all origins
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use('/uploads', express.static('uploads'));
app.use(mongoSanitize());

// Rate limiting and slow down
app.use(generalLimiter);
app.use(slowDownConfig);

// Swagger API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpecs, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Avasar Growth Platform API Documentation'
}));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create a write stream (in append mode) for server.log
const logStream = fs.createWriteStream(path.join(__dirname, 'server.log'), { flags: 'a' });

// Setup morgan to log all requests to server.log
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/withdrawal', withdrawalRoutes);

// Error-handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack || err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

// Add this at the end of the file
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err);
  process.exit(1); // Optional: exit process
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', reason);
});

// Cron job: pay out monthly investment bonuses on the 5th of every month at 00:05
cron.schedule('5 0 5 * *', async () => {
  try {
    const users = await User.find({ 'pendingInvestmentBonuses.0': { $exists: true } });
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-based
    const currentYear = now.getFullYear();
    for (const user of users) {
      let updated = false;
      for (const bonus of user.pendingInvestmentBonuses) {
        // Only pay if not already awarded, and for the current month/year
        const bonusDate = new Date(bonus.createdAt);
        const bonusMonth = bonusDate.getMonth() + bonus.month;
        const bonusYear = bonusDate.getFullYear() + Math.floor((bonusDate.getMonth() + bonus.month - 1) / 12);
        if (!bonus.awarded && bonusMonth === currentMonth && bonusYear === currentYear) {
          user.investmentReferralIncome = (user.investmentReferralIncome || 0) + bonus.amount;
          user.investmentReferralReturnIncome = (user.investmentReferralReturnIncome || 0) + bonus.amount;
          user.walletBalance = (user.walletBalance || 0) + bonus.amount;
          bonus.awarded = true;
          updated = true;
        }
      }
      if (updated) await user.save();
    }
    console.log('Monthly investment bonuses processed.');
    logger.info('Monthly investment bonuses processed.');
  } catch (err) {
    console.error('Error processing investment bonuses:', err);
    logger.error('Error processing investment bonuses:', err);
  }
});

// Cron job: reset matchingPairsToday for all users at midnight
cron.schedule('0 0 * * *', async () => {
  try {
    await User.updateMany({}, { $set: { matchingPairsToday: {} } });
    console.log('Reset matchingPairsToday for all users.');
    logger.info('Reset matchingPairsToday for all users.');
  } catch (err) {
    console.error('Error resetting matchingPairsToday:', err);
    logger.error('Error resetting matchingPairsToday:', err);
  }
});

// Cron job: process monthly investment payouts on the 1st of every month at 00:01
cron.schedule('1 0 1 * *', async () => {
  try {
    const investmentService = (await import('./services/investmentService.js')).default;
    const processed = await investmentService.processMonthlyPayouts();
    console.log(`Monthly investment payouts processed for ${processed} investments.`);
    logger.info(`Monthly investment payouts processed for ${processed} investments.`);
  } catch (err) {
    console.error('Error processing monthly investment payouts:', err);
    logger.error('Error processing monthly investment payouts:', err);
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
}); 