import dns from 'dns';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { createApp } from './app.js';

dns.setServers(['1.1.1.1', '8.8.8.8']);

dotenv.config();

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

const app = createApp();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
