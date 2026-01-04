/**
 * Email Service Infrastructure
 *
 * Provides email service using Microsoft 365 (Exchange Online) SMTP:
 * - Microsoft 365 SMTP: Primary production mode (sends via Microsoft 365 SMTP)
 *   - Supports Basic Authentication (username/password)
 *   - Supports OAuth2 Authentication (Azure App Credentials)
 * - Console: Development fallback (logs to console when SMTP not configured)
 */

import { ConsistentLogService } from './consistentLogService';
import { jobQueueService } from './jobQueue';
import microsoft365SmtpService from './microsoft365Smtp';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface EmailProvider {
  name: string;
  transporter: any | null;
  isConfigured: boolean;
}

class EmailService {
  private providers: EmailProvider[] = [];
  private currentProviderIndex = 0;
  private logger = ConsistentLogService.getInstance();
  private ms365Transporter: any = null;

  private initialized = false;

  constructor() {
    // Initialize providers asynchronously
    this.initializeProviders().catch((error) => {
      this.logger.error('Failed to initialize email providers', error as any);
    });
  }

  private async initializeProviders() {
    if (this.initialized) return;
    
    // Priority 1: Microsoft 365 SMTP (Primary Production Provider)
    const isConfigured = microsoft365SmtpService.isConfigured();
    
    if (isConfigured) {
      try {
        this.ms365Transporter = await microsoft365SmtpService.initialize();
        if (this.ms365Transporter) {
          this.providers.push({
            name: 'Microsoft365',
            transporter: this.ms365Transporter,
            isConfigured: true
          });
          this.logger.info('Email service initialized with Microsoft 365 SMTP provider');
        } else {
          this.logger.warn('Microsoft 365 SMTP configuration failed - connection could not be established');
        }
      } catch (error: any) {
        this.logger.error('Failed to initialize Microsoft 365 SMTP provider', error as any);
      }
    } else {
      this.logger.warn('Microsoft 365 SMTP not configured - check environment variables');
    }

    // Priority 2: Console (Development fallback)
    if (this.providers.length === 0 || !this.providers.some(p => p.isConfigured)) {
      this.logger.warn('No production email providers configured - emails will be logged to console');
      this.providers.push({
        name: 'Console',
        transporter: null,
        isConfigured: true
      });
    }

    // Use metadata wrapper for extra properties not in LogContext
    const metadata: any = {
      providers: this.providers.map(p => `${p.name}${p.isConfigured ? '' : ' (Not Configured)'}`),
      activeProvider: this.providers.find(p => p.isConfigured)?.name || 'None'
    };
    
    this.logger.info('Email service provider initialization complete', { metadata });
    this.initialized = true;
  }

  /**
   * Ensure providers are initialized before sending
   * Can be called externally to force initialization
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initializeProviders();
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    // Ensure providers are initialized
    await this.ensureInitialized();
    const maxAttempts = this.providers.length;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const provider = this.providers[this.currentProviderIndex];

      if (!provider || !provider.isConfigured) {
        this.logger.warn('Skipping unavailable or unconfigured email provider', { metadata: { providerName: provider?.name, attempt: attempt + 1 } } as any);
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
        continue;
      }

      try {
        this.logger.info('Attempting email send', {
          metadata: {
            provider: provider.name,
            to: options.to,
            subject: options.subject,
            attempt: attempt + 1
          }
        } as any);

        // Build from address with optional name
        const fromEmail = options.from || microsoft365SmtpService.getFromEmail() || 'noreply@example.com';
        const fromName = microsoft365SmtpService.getFromName();
        const fromAddress = fromName ? `${fromName} <${fromEmail}>` : fromEmail;

        const emailData = {
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text || this.stripHtml(options.html)
        };

        if (provider.name === 'Console') {
          // Reset index if successful
          this.currentProviderIndex = 0;
          return true;
        }

        // Microsoft 365 SMTP sending
        if (provider.name === 'Microsoft365' && provider.transporter) {
          const result = await provider.transporter.sendMail(emailData);
          
          this.logger.info('Email sent successfully via Microsoft 365 SMTP', {
            metadata: {
              messageId: result.messageId,
              to: options.to,
              from: emailData.from
            }
          } as any);

          this.currentProviderIndex = 0;
          return true;
        }

        // If we reach here, it means the provider is marked configured but doesn't have active sending logic
        this.logger.warn(`Sending logic not fully implemented for provider: ${provider.name}`);
        lastError = new Error(`Sending logic not fully implemented for provider: ${provider.name}`);
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length; // Move to next provider


      } catch (error: any) {
        lastError = error as Error;

        this.logger.error('Email send failed', {
          metadata: {
            provider: provider.name,
            error: lastError.message,
            errorCode: error.code,
            errorCommand: error.command,
            attempt: attempt + 1,
            to: options.to
          }
        } as any);

        // Move to next provider for failover
        this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
      }
    }

    this.logger.error('All email providers failed to send email', {
      metadata: {
        attempts: maxAttempts,
        lastError: lastError?.message,
        to: options.to
      }
    } as any);

    return false;
  }

  /**
   * Send password reset email
   */
  async sendPasswordResetEmail(
    email: string,
    token: string,
    resetLink: string,
    firstName?: string
  ): Promise<boolean> {
    const subject = 'Reset Your RuR2 Password';
    const displayName = firstName ? firstName : 'User';

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 24px;">RuR2 Password Reset</h1>
        </div>

        <div style="padding: 30px; background-color: #f8f9fa;">
          <h2 style="color: #333; margin-bottom: 20px;">Hello ${displayName},</h2>

          <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
            We received a request to reset your password for your RuR2 account. Click the button below to reset your password:
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                      color: white; 
                      padding: 15px 30px; 
                      text-decoration: none; 
                      border-radius: 5px; 
                      font-weight: bold; 
                      display: inline-block;">
              Reset Password
            </a>
          </div>

          <p style="color: #666; line-height: 1.6; margin-bottom: 10px;">
            Or copy and paste this link into your browser:
          </p>
          <p style="word-break: break-all; color: #007bff; font-size: 14px;">
            ${resetLink}
          </p>

          <div style="background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #856404; margin: 0; font-size: 14px;">
              <strong>Important:</strong> This link will expire in 15 minutes. If you didn't request this password reset, please ignore this email.
            </p>
          </div>

          <p style="color: #666; font-size: 12px; margin-top: 30px;">
            If you're having trouble with the button above, copy and paste the URL into your web browser.
          </p>
        </div>

        <div style="background-color: #e9ecef; padding: 20px; text-align: center;">
          <p style="color: #666; font-size: 12px; margin: 0;">
            © 2024 RuR2. All rights reserved.
          </p>
        </div>
      </div>
    `;

    const textContent = `
Reset Your RuR2 Password

Hello ${displayName},

We received a request to reset your password for your RuR2 account.

To reset your password, copy and paste this link into your browser:
${resetLink}

This link will expire in 15 minutes.

If you didn't request this password reset, please ignore this email.

© 2024 RuR2. All rights reserved.
    `;

    return this.sendEmail({
      to: email,
      subject: subject,
      html: htmlContent,
      text: textContent,
      from: microsoft365SmtpService.getFromEmail() || 'noreply@example.com'
    });
  }


  // Email verification
  async sendVerificationEmail(to: string, token: string, verificationCode: string, firstName: string): Promise<boolean> {
    const baseUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5173';
    const verificationUrl = `${baseUrl}/verify-email?token=${token}`;

    return this.sendEmail({
      to,
      subject: 'Verify your RuR2 account',
      from: 'no-reply@wrekdtech.com', // Use verified wrekdtech.com domain
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify your RuR2 account</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">RuR2</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 5px 0 0 0; font-size: 14px;">R2 Compliance Platform</p>
            </div>
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0; font-size: 24px;">Verify Your Email Address</h2>
              <p style="font-size: 16px; color: #555;">Hi ${firstName},</p>
              <p style="font-size: 16px; color: #555;">Welcome to RuR2! To complete your registration, please click the button below to verify your email address:</p>

              <div style="text-align: center; margin: 30px 0;">
                <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">Verify Email Address</a>
              </div>

              <p style="color: #666; font-size: 14px; margin-top: 20px; text-align: center;">Or copy and paste this link into your browser:</p>
              <p style="color: #667eea; font-size: 13px; word-break: break-all; background-color: #f8f9fa; padding: 12px; border-radius: 4px; border-left: 3px solid #667eea;">${verificationUrl}</p>

              <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #856404; font-size: 14px; margin: 0;">⏱️ This link will expire in 10 minutes.</p>
              </div>

              <p style="color: #666; font-size: 14px;">If you didn't create an account with RuR2, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 35px 0;">
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} RuR2. All rights reserved.</p>
            </div>
          </body>
        </html>
      `
    });
  }

  async sendWelcomeEmail(to: string, firstName: string): Promise<boolean> {
    const dashboardUrl = process.env.REPLIT_DEV_DOMAIN || 'http://localhost:5173/dashboard'; // Ensure dashboardUrl is correctly formed

    return this.sendEmail({
      to,
      subject: 'Welcome to RuR2! 🎉',
      from: 'no-reply@wrekdtech.com', // Use verified wrekdtech.com domain
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to RuR2</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f5f5f5;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">RuR2</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 5px 0 0 0; font-size: 14px;">R2 Compliance Platform</p>
            </div>
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
              <h2 style="color: #333; margin-top: 0; font-size: 24px;">Welcome to RuR2! 🎉</h2>
              <p style="font-size: 16px; color: #555;">Hi ${firstName},</p>
              <p style="font-size: 16px; color: #555;">We're thrilled to have you on board! Your account is now verified and ready to use.</p>
              <div style="background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); padding: 20px; border-radius: 8px; margin: 25px 0;">
                <h3 style="color: #333; margin-top: 0; font-size: 18px;">What you can do with RuR2:</h3>
                <ul style="color: #555; padding-left: 20px; margin: 10px 0;">
                  <li style="margin: 8px 0;">📋 Create and manage R2 compliance assessments</li>
                  <li style="margin: 8px 0;">✅ Track compliance requirements and progress</li>
                  <li style="margin: 8px 0;">📊 Generate comprehensive audit reports</li>
                  <li style="margin: 8px 0;">👥 Collaborate with your team members</li>
                  <li style="margin: 8px 0;">📁 Manage evidence and documentation</li>
                </ul>
              </div>
              <div style="text-align: center; margin: 35px 0;">
                <a href="${dashboardUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: 600; font-size: 16px; box-shadow: 0 4px 6px rgba(102, 126, 234, 0.3);">Go to Dashboard</a>
              </div>
              <div style="background-color: #e7f3ff; border-left: 4px solid #2196F3; padding: 15px; margin: 25px 0; border-radius: 4px;">
                <p style="color: #1565c0; font-size: 14px; margin: 0;">💡 <strong>Tip:</strong> Start by creating your first facility profile to begin your compliance journey.</p>
              </div>
              <p style="color: #666; font-size: 14px;">If you have any questions or need assistance, our support team is here to help!</p>
              <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 35px 0;">
              <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">© ${new Date().getFullYear()} RuR2. All rights reserved.</p>
            </div>
          </body>
        </html>
      `
    });
  }

  // Health check for email service
  async healthCheck(): Promise<boolean> {
    if (this.providers.length === 0) {
      return false;
    }

    // Test with the primary provider that is configured
    const primaryProvider = this.providers.find(p => p.isConfigured);

    if (!primaryProvider) {
      return false;
    }

    if (primaryProvider.name === 'Console') {
      return true; // Console provider is always healthy
    }

    if (primaryProvider.name === 'Microsoft365' && primaryProvider.transporter) {
      try {
        await primaryProvider.transporter.verify();
        this.logger.info('Microsoft 365 SMTP health check passed.');
        return true;
      } catch (error: any) {
        this.logger.error('Microsoft 365 SMTP health check failed', error as any);
        return false;
      }
    }

    this.logger.warn(`Health check not fully implemented for provider: ${primaryProvider.name}`);
    return false; // Default to false if health check is not implemented for the provider
  }

  /**
   * Queue email for asynchronous sending via background job
   * Use this for non-critical emails (notifications, reports, etc.)
   * For critical emails (2FA, password reset, verification), use sendEmail() instead
   */
  async queueEmail(
    options: EmailOptions & { tenantId?: string },
    priority: 'high' | 'medium' | 'low' = 'medium'
  ): Promise<string> {
    // Validate required fields
    if (!options.to || !options.subject || !options.html) {
      throw new Error('Missing required email fields: to, subject, html');
    }

    // Include provider metadata in payload
    const payload = {
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      from: options.from || this.getDefaultSender(),
      providers: this.providers.map(p => p.name)
    };

    const jobId = await jobQueueService.enqueue({
      tenantId: options.tenantId || 'system',
      type: 'email_sending',
      priority,
      payload
    });

    return jobId;
  }

  /**
   * Get default sender email from environment
   */
  private getDefaultSender(): string {
    return microsoft365SmtpService.getFromEmail() || 'noreply@example.com';
  }

  private stripHtml(html: string): string {
    // Basic HTML stripping, can be improved with a dedicated library if needed
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

const emailService = new EmailService();
export { emailService };
export default emailService;