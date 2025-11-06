
import { Request, Response, NextFunction } from 'express';
import { PortChecker } from '../utils/portChecker.js';

/**
 * Middleware to monitor port health and proxy status
 */
export const portHealthMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  // Only check on health endpoints
  if (!req.path.includes('/health') && !req.path.includes('/readyz')) {
    return next();
  }

  try {
    const isDevelopment = process.env.NODE_ENV === 'development';
    
    if (isDevelopment) {
      // Check if Vite dev server is healthy
      const viteHealthy = await PortChecker.checkProxyHealth('http://127.0.0.1:5173');
      
      if (!viteHealthy) {
        console.warn('⚠️  Vite dev server health check failed');
      }
      
      // Add port status to response
      req.portHealth = {
        viteServer: viteHealthy,
        expressServer: true // If we're here, Express is running
      };
    }
    
    next();
  } catch (error) {
    console.error('Port health check error:', error);
    next();
  }
};

// Extend Request interface
declare global {
  namespace Express {
    interface Request {
      portHealth?: {
        viteServer: boolean;
        expressServer: boolean;
      };
    }
  }
}
