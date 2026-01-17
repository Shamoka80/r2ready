import express, { Response, Request } from 'express';
import { authenticateUser, AuthenticatedRequest } from '../middleware/authMiddleware';
import { emailService } from '../services/emailService';
import { z } from 'zod';

const router = express.Router();

// Contact form validation schema
const contactFormSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  subject: z.string().min(1, 'Subject is required'),
  message: z.string().min(1, 'Message is required'),
});

/**
 * POST /api/contact
 * Send contact form message via email
 * Sends confirmation email to the client and notification to support
 * Works for both authenticated and non-authenticated users
 */
router.post('/', (async (req: Request, res: Response) => {
  try {
    // Validate request body
    const validatedData = contactFormSchema.parse(req.body);
    const { name, email, subject, message } = validatedData;

    // Get user info if authenticated (optional - form can be used by non-authenticated users too)
    const authReq = req as AuthenticatedRequest;
    // Use firstName and lastName from user if available, otherwise fall back to form name
    const userName = authReq.user ? `${authReq.user.firstName || ''} ${authReq.user.lastName || ''}`.trim() || name : name;
    const userEmail = authReq.user?.email || email;
    const userId = authReq.user?.id || 'anonymous';
    const tenantId = authReq.user?.tenantId || null;

    // Create HTML email content for client confirmation
    const clientEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Thank You for Contacting RuR2 Support</h1>
            </div>
            <div class="content">
              <p>Dear ${name},</p>
              <p>We have received your support request and will get back to you as soon as possible.</p>
              
              <div class="message-box">
                <strong>Your Message:</strong><br>
                <strong>Subject:</strong> ${subject}<br><br>
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <p>Our support team typically responds within 24-48 hours. For urgent matters, please call us at +1 (555) 123-4567.</p>
              
              <p>Best regards,<br>The RuR2 Support Team</p>
            </div>
            <div class="footer">
              <p>This is an automated confirmation email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Create plain text version
    const clientEmailText = `
Thank You for Contacting RuR2 Support

Dear ${name},

We have received your support request and will get back to you as soon as possible.

Your Message:
Subject: ${subject}

${message}

Our support team typically responds within 24-48 hours. For urgent matters, please call us at +1 (555) 123-4567.

Best regards,
The RuR2 Support Team

---
This is an automated confirmation email. Please do not reply to this message.
    `;

    // Send confirmation email to the client
    const emailSent = await emailService.sendEmail({
      to: userEmail,
      subject: `Support Request Received: ${subject}`,
      html: clientEmailHtml,
      text: clientEmailText,
    });

    if (!emailSent) {
      console.error('Failed to send confirmation email to client');
      // Continue anyway - we'll still log the request
    }

    // Also send notification to support team (optional - can be configured)
    const supportEmail = process.env.SUPPORT_EMAIL || 'support@rur2.com';
    const supportEmailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #dc2626; color: white; padding: 20px; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .info-box { background: white; padding: 15px; margin: 10px 0; border-left: 4px solid #dc2626; }
            .message-box { background: white; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h2>New Support Request</h2>
            </div>
            <div class="content">
              <div class="info-box">
                <strong>From:</strong> ${name} (${email})<br>
                ${authReq.user ? `<strong>User ID:</strong> ${userId}<br>` : ''}
                ${tenantId ? `<strong>Tenant ID:</strong> ${tenantId}<br>` : ''}
                <strong>Date:</strong> ${new Date().toLocaleString()}
              </div>
              
              <div class="message-box">
                <strong>Subject:</strong> ${subject}<br><br>
                <strong>Message:</strong><br>
                ${message.replace(/\n/g, '<br>')}
              </div>
              
              <p><a href="mailto:${email}">Reply to ${email}</a></p>
            </div>
          </div>
        </body>
      </html>
    `;

    // Send notification to support team (non-blocking)
    emailService.sendEmail({
      to: supportEmail,
      subject: `[Support Request] ${subject} - From: ${name}`,
      html: supportEmailHtml,
      text: `New support request from ${name} (${email})\n\nSubject: ${subject}\n\nMessage:\n${message}`,
    }).catch(err => {
      console.error('Failed to send support notification email:', err);
      // Don't fail the request if support notification fails
    });

    res.json({
      success: true,
      message: 'Your message has been sent successfully. You will receive a confirmation email shortly.',
    });
  } catch (error) {
    console.error('Contact form submission error:', error);
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation error',
        details: error.errors,
      });
    }

    res.status(500).json({
      success: false,
      error: 'Failed to send message. Please try again later.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}) as any);

export default router;

