import { Router, Request, Response } from 'express';
import { jobQueueService } from '../services/jobQueue.js';
import { insertJobSchema } from '../../shared/schema.js';
import { z } from 'zod';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validatedData = insertJobSchema.parse({
      tenantId: req.user.tenantId,
      type: req.body.type,
      payload: req.body.payload,
      priority: req.body.priority || 'medium',
      maxAttempts: req.body.maxAttempts || 3,
      status: 'PENDING',
      attempts: 0,
      result: null,
      error: null,
      completedAt: null,
    });

    const jobId = await jobQueueService.enqueue({
      tenantId: validatedData.tenantId,
      type: validatedData.type,
      payload: validatedData.payload,
      priority: validatedData.priority as 'low' | 'medium' | 'high',
      maxAttempts: validatedData.maxAttempts,
    });

    const job = await jobQueueService.getJob(jobId);

    res.status(201).json(job);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation error', details: error.errors });
    }
    console.error('[Jobs API] Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const job = await jobQueueService.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    res.json(job);
  } catch (error) {
    console.error('[Jobs API] Error fetching job:', error);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const jobs = await jobQueueService.getJobsByTenant(req.user.tenantId, limit);

    res.json(jobs);
  } catch (error) {
    console.error('[Jobs API] Error fetching jobs:', error);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

router.post('/:id/retry', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const job = await jobQueueService.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await jobQueueService.retry(req.params.id);

    const retryJob = await jobQueueService.getJob(req.params.id);

    res.json(retryJob);
  } catch (error: any) {
    console.error('[Jobs API] Error retrying job:', error);
    res.status(500).json({ error: error.message || 'Failed to retry job' });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userRole = req.user.businessRole || req.user.consultantRole;
    const isAdmin = userRole === 'business_owner' || userRole === 'consultant_owner';

    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const job = await jobQueueService.getJob(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await jobQueueService.updateStatus(req.params.id, 'FAILED', null, 'Deleted by admin');

    res.json({ message: 'Job deleted successfully' });
  } catch (error) {
    console.error('[Jobs API] Error deleting job:', error);
    res.status(500).json({ error: 'Failed to delete job' });
  }
});

export default router;
