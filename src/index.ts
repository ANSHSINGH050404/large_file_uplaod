import express from 'express';
import { systemRouter } from './routes/system';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/v1', systemRouter);

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Express server running on Bun at http://localhost:${PORT}`);
});