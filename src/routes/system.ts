import { Router, type Request, type Response } from 'express';
import { ProcessService } from '../services/process';



export const systemRouter = Router();


systemRouter.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});


systemRouter.post('/trigger', async (req: Request, res: Response) => {
  try {
    const { taskId, action } = req.body;

    // Basic validation
    if (!taskId || !action) {
      res.status(400).json({ error: 'Missing taskId or action' });
      return;
    }

    const result = await ProcessService.executeTask(req.body);
    res.status(202).json({ message: 'Task queued successfully', data: result });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});







