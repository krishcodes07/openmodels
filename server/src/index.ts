import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from './config';
import { errorHandler } from './middleware/error';

// Feature routes
import authRoutes from './features/auth/routes';
import conversationRoutes from './features/conversations/routes';
import chatRoutes from './features/chat/routes';
import providerRoutes from './features/providers/routes';
import settingsRoutes from './features/settings/routes';

import path from 'path';
import fs from 'fs';

const app = express();

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, '../uploads');
try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch (err) {
  console.warn('Could not create uploads directory (expected in read-only environments like Vercel):', err);
}

// Middleware
app.use(cors({
  origin: config.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());
app.use('/uploads', express.static(uploadsDir));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/conversations', conversationRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/providers', providerRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handler
app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`
  ╔═══════════════════════════════════════╗
  ║     🚀 OpenModels Server Running     ║
  ║     Port: ${String(config.port).padEnd(26)}║
  ║     Env:  ${config.nodeEnv.padEnd(26)}║
  ╚═══════════════════════════════════════╝
  `);
});

export default app;
