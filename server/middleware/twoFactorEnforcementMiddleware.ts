import { Request, Response, NextFunction } from 'express';
import { TwoFactorAuthService } from '../services/twoFactorAuthService.js';

export interface EnhancedRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    consultantRole?: string | null;
    tenant?: {
      tenantType: string;
    };
    [key: string]: any;
  };
}

/**
 * Middleware to enforce 2FA enrollment for consultant accounts
 * 
 * This middleware should be applied to protected routes after authentication
 * but before accessing sensitive resources. It checks if a user is a consultant
 * and forces 2FA enrollment if not already enabled.
 */
export class TwoFactorEnforcementMiddleware {
  private twoFactorService: TwoFactorAuthService;

  constructor() {
    this.twoFactorService = new TwoFactorAuthService();
  }

  /**
   * Check if user is a consultant account requiring 2FA
   */
  private isConsultantAccount(user: EnhancedRequest['user']): boolean {
    if (!user) return false;

    // Check if user has a consultant role
    if (user.consultantRole) return true;

    // Check if user belongs to a consultant tenant
    if (user.tenant?.tenantType === 'CONSULTANT') return true;

    return false;
  }

  /**
   * Routes that should be excluded from 2FA enforcement
   * These are typically 2FA setup routes and basic auth routes
   * Note: Express routers strip mounting prefix, so we check against router paths
   */
  private isExemptRoute(req: EnhancedRequest): boolean {
    const fullPath = req.baseUrl + req.path;
    const routerPath = req.path;
    
    // Routes that should be exempt (checking both full path and router path for safety)
    const exemptPaths = [
      // Full API paths
      '/api/auth/logout',
      '/api/auth/2fa/',
      '/api/auth/me',
      '/api/health',
      // Router-level paths (after mounting prefix is stripped)
      '/auth/logout',
      '/auth/2fa/',
      '/auth/me',
      '/logout',
      '/2fa/',
      '/me',
    ];

    // Check if path starts with any exempt path
    const isExempt = exemptPaths.some(exemptPath => 
      fullPath.startsWith(exemptPath) || 
      routerPath.startsWith(exemptPath) ||
      fullPath === exemptPath ||
      routerPath === exemptPath
    );
    
    // Additional specific checks for 2FA setup routes
    if (fullPath.includes('/2fa/') || routerPath.includes('/2fa/')) {
      return true;
    }
    
    return isExempt;
  }

  /**
   * Main enforcement middleware function
   */
  enforce = async (req: EnhancedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip enforcement for exempt routes
      if (this.isExemptRoute(req)) {
        return next();
      }

      // Skip if no authenticated user
      if (!req.user) {
        return next();
      }

      // Check if this is a consultant account
      if (!this.isConsultantAccount(req.user)) {
        return next(); // Not a consultant, proceed normally
      }

      // Check 2FA status for consultant account
      const twoFactorStatus = await this.twoFactorService.getStatus(req.user.id);

      if (!twoFactorStatus.isEnabled) {
        console.log(`2FA enforcement: Consultant user ${req.user.id} requires 2FA setup for route ${req.path}`);

        // Return error requiring 2FA setup
        res.status(403).json({
          success: false,
          error: 'CONSULTANT_2FA_REQUIRED',
          message: 'Consultant accounts must enable two-factor authentication before accessing this resource.',
          data: {
            setupRequired: true,
            redirectTo: '/setup-2fa',
            userRole: req.user.consultantRole || 'consultant',
            tenantType: req.user.tenant?.tenantType,
          }
        });
        return;
      }

      // 2FA is enabled, proceed
      next();

    } catch (error) {
      console.error('2FA enforcement middleware error:', error);
      
      // Log the error and block access for security
      if (req.user) {
        console.error(`2FA enforcement error for user ${req.user.id} on route ${req.path}:`, error);
      }

      // Fail securely - block access when enforcement fails
      res.status(500).json({
        success: false,
        error: 'SECURITY_ENFORCEMENT_ERROR',
        message: 'Security validation failed. Please try again or contact support.'
      });
      return;
    }
  };

  /**
   * Factory method to create the middleware function
   * This is the main export that should be used in routes
   */
  static create(): (req: EnhancedRequest, res: Response, next: NextFunction) => Promise<void> {
    const middleware = new TwoFactorEnforcementMiddleware();
    return middleware.enforce;
  }
}

// Export the factory function for easy import
export const twoFactorEnforcementMiddleware = TwoFactorEnforcementMiddleware.create();