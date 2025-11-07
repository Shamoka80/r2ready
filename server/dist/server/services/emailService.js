/**
 * Email Service Infrastructure
 *
 * Provides a flexible email service with support for multiple providers:
 * - Resend: Production mode (sends via Resend API)
 * - SendGrid: Production mode (sends via SendGrid API)
 * - SMTP: Production mode (sends via SMTP - Office 365, Gmail, etc.)
 * - Console: Development mode (logs to console)
 */
import { Resend } from 'resend';
import { ConsistentLogService } from './consistentLogService';
class EmailService {
    providers = [];
    currentProviderIndex = 0;
    logger = ConsistentLogService.getInstance();
    constructor() {
        this.initializeProviders();
    }
    initializeProviders() {
        // Priority 1: Resend (Primary)
        if (process.env.RESEND_API_KEY) {
            try {
                const resendClient = new Resend(process.env.RESEND_API_KEY);
                this.providers.push({
                    name: 'Resend',
                    transporter: null,
                    isConfigured: true,
                    resendClient
                });
                this.logger.info('Email service initialized with Resend provider');
                return;
            }
            catch (error) {
                this.logger.error('Failed to initialize Resend provider', error);
            }
        }
        // Priority 2: SendGrid (Fallback #1) - If SENDGRID_API_KEY and SENDGRID_FROM_EMAIL exist
        if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_FROM_EMAIL) {
            try {
                // Note: SendGrid provider is kept for compatibility but Resend is prioritized.
                // Nodemailer is used here for SendGrid as Resend SDK is for Resend only.
                const nodemailer = require('nodemailer'); // Import nodemailer only if needed
                this.providers.push({
                    name: 'SendGrid',
                    transporter: null,
                    isConfigured: true
                });
                this.logger.info('Email service configured with SendGrid provider (Resend is prioritized)');
            }
            catch (error) {
                this.logger.warn('Failed to initialize SendGrid provider', error);
            }
        }
        // Priority 3: SMTP (Fallback #2) - If SMTP credentials exist
        if (process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM_EMAIL) {
            try {
                const nodemailer = require('nodemailer'); // Import nodemailer only if needed
                // Note: SMTP provider is kept for compatibility but Resend is prioritized.
                this.providers.push({
                    name: 'SMTP',
                    transporter: null,
                    isConfigured: true
                });
                this.logger.info(`Email service configured with SMTP provider (${process.env.SMTP_HOST}) (Resend is prioritized)`);
            }
            catch (error) {
                this.logger.warn('Failed to initialize SMTP provider', error);
            }
        }
        // Priority 4: Console (Development fallback)
        if (this.providers.length === 0 || !this.providers.some(p => p.isConfigured)) {
            this.logger.warn('No production email providers configured - emails will be logged to console');
            this.providers.push({
                name: 'Console',
                transporter: null,
                isConfigured: true
            });
            this.logger.info('Email service initialized with Console provider');
        }
        this.logger.info('Email service provider initialization complete', {
            providers: this.providers.map(p => `${p.name}${p.isConfigured ? '' : ' (Not Configured)'}`),
            activeProvider: this.providers.find(p => p.isConfigured)?.name || 'None'
        });
    }
    async sendEmail(options) {
        const maxAttempts = this.providers.length;
        let lastError = null;
        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const provider = this.providers[this.currentProviderIndex];
            if (!provider || !provider.isConfigured) {
                this.logger.warn('Skipping unavailable or unconfigured email provider', { providerName: provider?.name, attempt: attempt + 1 });
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
                continue;
            }
            try {
                this.logger.info('Attempting email send', {
                    provider: provider.name,
                    to: options.to,
                    subject: options.subject,
                    attempt: attempt + 1
                });
                const emailData = {
                    from: options.from || process.env.RESEND_FROM_EMAIL || 'no-reply@wrekdtech.com',
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                    text: options.text || this.stripHtml(options.html)
                };
                if (provider.name === 'Console') {
                    console.log('\n╔════════════════════════════════════════════════════════════╗');
                    console.log('║           📧 EMAIL: Logged to Console (Development)         ║');
                    console.log('╠════════════════════════════════════════════════════════════╣');
                    console.log(`  From: ${emailData.from}`);
                    console.log(`  To: ${emailData.to}`);
                    console.log(`  Subject: ${emailData.subject}`);
                    console.log('────────────────────────────────────────────────────────────');
                    console.log(emailData.html);
                    console.log('╚════════════════════════════════════════════════════════════╝\n');
                    // Reset index if successful
                    this.currentProviderIndex = 0;
                    return true;
                }
                if (provider.name === 'Resend' && provider.resendClient) {
                    const { data, error } = await provider.resendClient.emails.send({
                        from: emailData.from,
                        to: emailData.to,
                        subject: emailData.subject,
                        html: emailData.html
                    });
                    if (error) {
                        throw new Error(`Resend error: ${error.message}`);
                    }
                    this.logger.info('Email sent successfully via Resend', {
                        messageId: data?.id,
                        to: options.to
                    });
                    this.currentProviderIndex = 0;
                    return true;
                }
                // Fallback to Nodemailer for SendGrid and SMTP if they are configured
                // This requires nodemailer to be imported and configured transporters to be available.
                // For simplicity and due to the interface change, these are currently marked as configured
                // but the actual sending logic using nodemailer is commented out.
                // If SendGrid/SMTP are to be used, the EmailProvider interface and initialization
                // would need to be re-evaluated to store transporters.
                // Placeholder for SendGrid/SMTP sending logic using Nodemailer if needed:
                // Example (requires nodemailer and transporter setup):
                // if ((provider.name === 'SendGrid' || provider.name === 'SMTP') && provider.transporter) {
                //   const result = await provider.transporter.sendMail(emailData);
                //   this.logger.info(`Email sent successfully via ${provider.name}`, { messageId: result.messageId, to: options.to });
                //   this.currentProviderIndex = 0;
                //   return true;
                // }
                // If we reach here, it means the provider is marked configured but doesn't have active sending logic implemented in this simplified version.
                this.logger.warn(`Sending logic not fully implemented for provider: ${provider.name}`);
                lastError = new Error(`Sending logic not fully implemented for provider: ${provider.name}`);
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length; // Move to next provider
            }
            catch (error) {
                lastError = error;
                this.logger.error('Email send failed', {
                    provider: provider.name,
                    error: lastError.message,
                    attempt: attempt + 1,
                    to: options.to
                });
                // Move to next provider for failover
                this.currentProviderIndex = (this.currentProviderIndex + 1) % this.providers.length;
            }
        }
        this.logger.error('All email providers failed to send email', {
            attempts: maxAttempts,
            lastError: lastError?.message,
            to: options.to
        });
        return false;
    }
    /**
     * Send password reset email
     */
    async sendPasswordResetEmail(email, token, resetLink, firstName) {
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
            from: 'no-reply@wrekdtech.com' // Use verified wrekdtech.com domain
        });
    }
    // Email verification
    async sendVerificationEmail(to, token, verificationCode, firstName) {
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
    async sendWelcomeEmail(to, firstName) {
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
    async healthCheck() {
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
        if (primaryProvider.name === 'Resend' && primaryProvider.resendClient) {
            try {
                // Resend doesn't have a direct 'verify' method like nodemailer.
                // We can simulate a health check by trying to send a minimal email.
                // For a more robust check, consider a dedicated Resend status endpoint if available.
                await primaryProvider.resendClient.emails.send({
                    from: process.env.RESEND_FROM_EMAIL || 'no-reply@wrekdtech.com',
                    to: ['test@example.com'], // Use a dummy recipient for health check
                    subject: 'Resend Health Check',
                    html: '<div>Resend service is healthy.</div>',
                });
                this.logger.info('Resend service health check passed.');
                return true;
            }
            catch (error) {
                this.logger.error('Resend service health check failed', error);
                return false;
            }
        }
        // Placeholder for SendGrid/SMTP health check if needed and transporters were stored
        // if ((primaryProvider.name === 'SendGrid' || primaryProvider.name === 'SMTP') && primaryProvider.transporter) {
        //   try {
        //     await primaryProvider.transporter.verify();
        //     return true;
        //   } catch (error) {
        //     this.logger.error(`Email service health check failed for ${primaryProvider.name}`, {
        //       provider: primaryProvider.name,
        //       error: (error as Error).message
        //     });
        //     return false;
        //   }
        // }
        this.logger.warn(`Health check not fully implemented for provider: ${primaryProvider.name}`);
        return false; // Default to false if health check is not implemented for the provider
    }
    stripHtml(html) {
        // Basic HTML stripping, can be improved with a dedicated library if needed
        return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    }
}
const emailService = new EmailService();
export { emailService };
export default emailService;
