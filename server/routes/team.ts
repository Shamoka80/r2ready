import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db';
import { users, assessments, tenants } from '../../shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { AuthService } from '../services/authService';
import type { AuthenticatedRequest } from '../services/authService';
import { validateRoleAssignment } from './auth.js';

const router = Router();

// Most routes require authentication, except invitation acceptance
// Authentication middleware will be applied selectively
const authMiddleware = AuthService.authMiddleware;

/**
 * Role mapping between frontend simple role names and backend role names
 */
const FRONTEND_TO_BACKEND_ROLES: Record<string, string> = {
  'admin': 'business_owner',      // Admin maps to business_owner
  'manager': 'facility_manager',   // Manager maps to facility_manager
  'user': 'team_member',           // User maps to team_member
  'viewer': 'viewer',              // Viewer stays the same
};

const BACKEND_TO_FRONTEND_ROLES: Record<string, string> = {
  'business_owner': 'admin',
  'facility_manager': 'manager',
  'team_member': 'user',
  'viewer': 'viewer',
  'compliance_officer': 'manager', // Compliance officer maps to manager
  'consultant_owner': 'admin',
  'lead_consultant': 'manager',
  'associate_consultant': 'user',
  'client_collaborator': 'viewer',
};

/**
 * Convert frontend role to backend role
 */
function toBackendRole(frontendRole: string): string {
  return FRONTEND_TO_BACKEND_ROLES[frontendRole.toLowerCase()] || frontendRole;
}

/**
 * Convert backend role to frontend role
 */
function toFrontendRole(backendRole: string | null): string {
  if (!backendRole) return 'user';
  return BACKEND_TO_FRONTEND_ROLES[backendRole] || backendRole.toLowerCase();
}

/**
 * GET /api/team/members
 * Get all team members for the tenant
 */
router.get('/members', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const tenantUsers = await db.query.users.findMany({
      where: eq(users.tenantId, req.tenant!.id),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        businessRole: true,
        consultantRole: true,
        isActive: true,
        lastLoginAt: true,
        invitedAt: true,
        createdAt: true,
      },
    });

    // Get assessment counts for each user
    const userIds = tenantUsers.map(u => u.id);
    let assessmentCounts: Record<string, number> = {};
    
    if (userIds.length > 0) {
      // Use drizzle query builder for better compatibility
      const assessmentResults = await db
        .select({
          createdBy: assessments.createdBy,
          count: sql<number>`COUNT(*)`.as('count'),
        })
        .from(assessments)
        .where(
          and(
            inArray(assessments.createdBy, userIds),
            eq(assessments.tenantId, req.tenant!.id)
          )
        )
        .groupBy(assessments.createdBy);
      
      assessmentResults.forEach((row: any) => {
        assessmentCounts[row.createdBy] = typeof row.count === 'number' ? row.count : parseInt(String(row.count || '0'), 10);
      });
    }

    const teamMembers = tenantUsers.map(user => ({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: toFrontendRole(user.businessRole || user.consultantRole),
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt?.toISOString(),
      assignedAssessments: assessmentCounts[user.id] || 0,
      createdAt: user.createdAt.toISOString(),
    }));

    res.json(teamMembers);

  } catch (error) {
    console.error('Get team members error:', error);
    res.status(500).json({ error: 'Failed to get team members' });
  }
});

/**
 * POST /api/team/invite
 * Invite a new team member
 */
router.post('/invite', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const inviteSchema = z.object({
      email: z.string().email(),
      role: z.string(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
    });

    const data = inviteSchema.parse(req.body);

    // Convert frontend role to backend role
    const backendRole = toBackendRole(data.role);

    // Validate role assignment permissions
    const userRole = req.user!.businessRole || req.user!.consultantRole;
    const canAssignRole = await validateRoleAssignment(userRole!, backendRole);

    if (!canAssignRole) {
      return res.status(403).json({ error: 'Cannot assign this role' });
    }

    // Provide default values for firstName and lastName if not provided
    // Extract from email if possible, otherwise use placeholders
    // Handle both undefined and empty string cases
    let firstName = data.firstName?.trim();
    let lastName = data.lastName?.trim();
    
    // Ensure firstName is not empty or undefined
    if (!firstName || firstName.length === 0) {
      // Try to extract from email (e.g., "john.doe@example.com" -> "John")
      const emailName = data.email.split('@')[0].trim();
      if (emailName.includes('.')) {
        const firstPart = emailName.split('.')[0];
        firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      } else if (emailName.includes('_')) {
        const firstPart = emailName.split('_')[0];
        firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      } else if (emailName.includes('-')) {
        const firstPart = emailName.split('-')[0];
        firstName = firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
      } else {
        firstName = emailName.charAt(0).toUpperCase() + emailName.slice(1).toLowerCase();
      }
    }
    
    // Ensure lastName is not empty or undefined
    if (!lastName || lastName.length === 0) {
      // Try to extract from email if available
      const emailName = data.email.split('@')[0].trim();
      if (emailName.includes('.')) {
        const parts = emailName.split('.');
        if (parts.length > 1 && parts[parts.length - 1]) {
          const lastPart = parts[parts.length - 1];
          lastName = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).toLowerCase();
        } else {
          lastName = 'User';
        }
      } else if (emailName.includes('_')) {
        const parts = emailName.split('_');
        if (parts.length > 1 && parts[parts.length - 1]) {
          const lastPart = parts[parts.length - 1];
          lastName = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).toLowerCase();
        } else {
          lastName = 'User';
        }
      } else if (emailName.includes('-')) {
        const parts = emailName.split('-');
        if (parts.length > 1 && parts[parts.length - 1]) {
          const lastPart = parts[parts.length - 1];
          lastName = lastPart.charAt(0).toUpperCase() + lastPart.slice(1).toLowerCase();
        } else {
          lastName = 'User';
        }
      } else {
        lastName = 'User';
      }
    }
    
    // Final safety check - ensure we never pass undefined or empty strings
    // Handle undefined, null, or empty string cases
    if (!firstName || typeof firstName !== 'string' || firstName.trim().length === 0) {
      firstName = 'User';
    } else {
      firstName = firstName.trim();
    }
    
    if (!lastName || typeof lastName !== 'string' || lastName.trim().length === 0) {
      lastName = 'User';
    } else {
      lastName = lastName.trim();
    }

    // Invite the user using AuthService (always send email for team invites)
    const user = await AuthService.inviteUser(
      req.tenant!.id,
      req.user!.id,
      data.email,
      firstName, // Guaranteed to be a non-empty string
      lastName,  // Guaranteed to be a non-empty string
      backendRole,
      true // sendEmail - always send invitation email for team invites
    );

    res.status(201).json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: toFrontendRole(user.businessRole || user.consultantRole),
        isActive: user.isActive,
        invitedAt: user.invitedAt,
      },
    });

  } catch (error) {
    console.error('Invite team member error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    if (error instanceof Error && error.message === 'User already exists in this tenant') {
      return res.status(400).json({ error: error.message });
    }
    // Provide more detailed error message for database errors
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('Detailed invite error:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    res.status(500).json({ 
      error: 'Failed to invite team member',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    });
  }
});

/**
 * PUT /api/team/members/:userId/role
 * Update team member role
 */
router.put('/members/:userId/role', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;
    const updateSchema = z.object({
      role: z.string(),
    });

    const data = updateSchema.parse(req.body);

    // Convert frontend role to backend role
    const backendRole = toBackendRole(data.role);

    // Validate role assignment permissions
    const userRole = req.user!.businessRole || req.user!.consultantRole;
    const canAssignRole = await validateRoleAssignment(userRole!, backendRole);

    if (!canAssignRole) {
      return res.status(403).json({ error: 'Cannot assign this role' });
    }

    // Verify target user is in same tenant
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.tenantId, req.tenant!.id)
      ),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Assign the role using AuthService
    await AuthService.assignRole(userId, backendRole, req.user!.id);

    res.json({ 
      success: true, 
      message: 'Role updated successfully',
      role: toFrontendRole(backendRole),
    });

  } catch (error) {
    console.error('Update team member role error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * DELETE /api/team/members/:userId
 * Deactivate a team member
 */
router.delete('/members/:userId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { userId } = req.params;

    // Prevent users from deactivating themselves
    if (userId === req.user!.id) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Verify target user is in same tenant
    const targetUser = await db.query.users.findFirst({
      where: and(
        eq(users.id, userId),
        eq(users.tenantId, req.tenant!.id)
      ),
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Deactivate the user
    await db.update(users)
      .set({
        isActive: false,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId));

    // Log audit event
    await AuthService.logAuditEvent(
      req.tenant!.id,
      req.user!.id,
      'USER_DEACTIVATED',
      'user',
      userId,
      {
        email: targetUser.email,
        deactivatedBy: req.user!.id,
      }
    );

    res.json({ 
      success: true, 
      message: 'Team member deactivated successfully' 
    });

  } catch (error) {
    console.error('Deactivate team member error:', error);
    res.status(500).json({ error: 'Failed to deactivate team member' });
  }
});

/**
 * GET /api/team/invitation/:token
 * Get invitation details by token (to verify token before showing accept form)
 */
router.get('/invitation/:token', async (req, res) => {
  try {
    const { token } = req.params;

    // Find user with matching invitation token
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, token),
      columns: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        businessRole: true,
        consultantRole: true,
        emailVerificationTokenExpiry: true,
        isActive: true,
        invitedAt: true,
        passwordHash: true,
      },
      with: {
        tenant: {
          columns: {
            id: true,
            name: true,
            tenantType: true,
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Invalid invitation token' });
    }

    // Check if token expired
    const now = new Date();
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < now) {
      return res.status(400).json({ 
        error: 'Invitation token has expired',
        expired: true 
      });
    }

    // Check if already activated (has password)
    if (user.passwordHash) {
      return res.status(400).json({ 
        error: 'Invitation has already been accepted',
        alreadyAccepted: true 
      });
    }

    res.json({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: toFrontendRole(user.businessRole || user.consultantRole),
      },
      tenant: (user as any).tenant,
    });

  } catch (error) {
    console.error('Get invitation error:', error);
    res.status(500).json({ error: 'Failed to verify invitation' });
  }
});

/**
 * POST /api/team/accept-invitation
 * Accept team invitation, set password, and activate account
 */
router.post('/accept-invitation', async (req, res) => {
  try {
    const acceptSchema = z.object({
      token: z.string(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      confirmPassword: z.string().min(8),
    }).refine(data => data.password === data.confirmPassword, {
      message: "Passwords don't match",
      path: ["confirmPassword"],
    });

    const data = acceptSchema.parse(req.body);

    // Find user with matching invitation token
    const user = await db.query.users.findFirst({
      where: eq(users.emailVerificationToken, data.token),
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid invitation token' });
    }

    // Check if token expired
    const now = new Date();
    if (user.emailVerificationTokenExpiry && user.emailVerificationTokenExpiry < now) {
      return res.status(400).json({
        error: 'Invitation token has expired. Please contact your administrator for a new invitation.',
        expired: true
      });
    }

    // Check if already activated
    if (user.passwordHash) {
      return res.status(400).json({ 
        error: 'Invitation has already been accepted. Please log in instead.',
        alreadyAccepted: true 
      });
    }

    // Hash password and activate user
    const passwordHash = await AuthService.hashPassword(data.password);

    await db.update(users)
      .set({
        passwordHash,
        isActive: true,
        emailVerified: true,
        emailVerifiedAt: new Date(),
        emailVerificationToken: null,
        emailVerificationTokenExpiry: null,
        setupStatus: 'setup_pending',
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));

    // Get tenant info
    const tenant = await db.query.tenants.findFirst({
      where: eq(tenants.id, user.tenantId),
    });

    if (!tenant) {
      return res.status(500).json({ error: 'Tenant not found' });
    }

    // Create session and automatically log in the user
    const { session, token: authToken } = await AuthService.createSession(
      user.id,
      user.tenantId,
      req.ip || 'unknown',
      req.get('User-Agent') || 'unknown'
    );

    // Get user permissions
    const permissions = await AuthService.getUserPermissions(
      user.businessRole || user.consultantRole || 'team_member'
    );

    // Log acceptance
    await AuthService.logAuditEvent(
      user.tenantId,
      user.id,
      'INVITATION_ACCEPTED',
      'user',
      user.id,
      {
        email: user.email,
        role: user.businessRole || user.consultantRole,
      }
    );

    res.json({
      success: true,
      message: 'Invitation accepted successfully',
      authToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: toFrontendRole(user.businessRole || user.consultantRole),
        isActive: true,
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        type: tenant.tenantType,
      },
      permissions,
      session: {
        id: session.id,
        expiresAt: session.expiresAt,
      },
    });

  } catch (error) {
    console.error('Accept invitation error:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid request data', details: error.errors });
    }
    res.status(500).json({ error: 'Failed to accept invitation' });
  }
});

/**
 * POST /api/team/test-email
 * Test endpoint to verify email sending (development only)
 */
router.post('/test-email', authMiddleware, async (req: AuthenticatedRequest, res) => {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'Email address is required' });
    }

    // Import emailService
    const { emailService } = await import('../services/emailService.js');
    
    // Ensure initialized
    await emailService.ensureInitialized();

    // Get frontend URL
    const frontendUrl = process.env.FRONTEND_URL || process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5173';
    const testLink = `${frontendUrl}/accept-invitation?token=test-token-123`;

    console.log('🧪 Testing email service...', {
      to: email,
      provider: 'team invite test',
      frontendUrl,
    });

    const emailSent = await emailService.sendTeamInviteEmail(
      email,
      'Test',
      'team_member',
      testLink,
      req.tenant!.id
    );

    if (emailSent) {
      res.json({
        success: true,
        message: 'Test email sent successfully. Check your inbox and console logs.',
        email,
      });
    } else {
      res.status(500).json({
        success: false,
        error: 'Email service returned false. Check server logs for details.',
        email,
      });
    }
  } catch (error) {
    console.error('Test email error:', error);
    res.status(500).json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;

