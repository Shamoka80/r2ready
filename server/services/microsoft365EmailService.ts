/**
 * Microsoft 365 Email Service
 * 
 * Provides email sending via Microsoft Graph API using app-only authentication.
 * This service uses client credentials flow (OAuth 2.0) to authenticate without user interaction.
 * 
 * Required Environment Variables:
 * - MICROSOFT_365_CLIENT_ID: Azure AD Application (Client) ID
 * - MICROSOFT_365_CLIENT_SECRET: Azure AD Client Secret
 * - MICROSOFT_365_TENANT_ID: Azure AD Directory (Tenant) ID
 * - MICROSOFT_365_FROM_EMAIL: Email address of the mailbox to send from (e.g., noreply@yourcompany.com)
 */

import { Client } from '@microsoft/microsoft-graph-client';
import { ConsistentLogService } from './consistentLogService';

interface Microsoft365EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

interface AccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export class Microsoft365EmailService {
  private graphClient: Client | null = null;
  private logger = ConsistentLogService.getInstance();
  private isConfigured = false;
  private fromEmail: string;
  private clientId: string = '';
  private clientSecret: string = '';
  private tenantId: string = '';
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;

  constructor() {
    this.initialize();
  }

  private initialize(): void {
    const clientId = process.env.MICROSOFT_365_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_365_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_365_TENANT_ID;
    this.fromEmail = process.env.MICROSOFT_365_FROM_EMAIL || '';

    // Check if all required environment variables are set
    if (!clientId || !clientSecret || !tenantId || !this.fromEmail) {
      const missingVars: string[] = [];
      if (!clientId) missingVars.push('MICROSOFT_365_CLIENT_ID');
      if (!clientSecret) missingVars.push('MICROSOFT_365_CLIENT_SECRET');
      if (!tenantId) missingVars.push('MICROSOFT_365_TENANT_ID');
      if (!this.fromEmail) missingVars.push('MICROSOFT_365_FROM_EMAIL');

      this.logger.warn('Microsoft 365 email service not configured - missing environment variables', {
        metadata: { missingVariables: missingVars }
      } as any);
      this.isConfigured = false;
      return;
    }

    this.clientId = clientId;
    this.clientSecret = clientSecret;
    this.tenantId = tenantId;

    try {
      // Initialize Microsoft Graph client with custom authentication
      this.graphClient = Client.init({
        authProvider: async (done) => {
          try {
            const token = await this.getAccessToken();
            done(null, token);
          } catch (error) {
            done(error as Error, null);
          }
        }
      });

      this.isConfigured = true;
      this.logger.info('Microsoft 365 email service initialized successfully', {
        metadata: {
          fromEmail: this.fromEmail,
          tenantId: tenantId.substring(0, 8) + '...' // Log partial tenant ID for debugging
        }
      } as any);
    } catch (error) {
      this.logger.error('Failed to initialize Microsoft 365 email service', error as any);
      this.isConfigured = false;
      this.graphClient = null;
    }
  }

  /**
   * Get access token using client credentials flow
   */
  private async getAccessToken(): Promise<string> {
    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    // Request new access token
    const tokenEndpoint = `https://login.microsoftonline.com/${this.tenantId}/oauth2/v2.0/token`;
    
    const params = new URLSearchParams();
    params.append('client_id', this.clientId);
    params.append('client_secret', this.clientSecret);
    params.append('scope', 'https://graph.microsoft.com/.default');
    params.append('grant_type', 'client_credentials');

    try {
      const response = await fetch(tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorDetails: any = {};
        try {
          errorDetails = JSON.parse(errorText);
        } catch {
          errorDetails = { raw: errorText };
        }
        
        const errorMessage = errorDetails.error_description || errorDetails.error || errorText;
        const errorCode = errorDetails.error || `HTTP_${response.status}`;
        
        this.logger.error('Failed to acquire Microsoft 365 access token', {
          metadata: {
            statusCode: response.status,
            errorCode: errorCode,
            errorMessage: errorMessage,
            fullError: errorDetails,
            tenantId: this.tenantId.substring(0, 8) + '...',
            clientId: this.clientId.substring(0, 8) + '...'
          }
        } as any);
        
        throw new Error(`Failed to get access token (${response.status}): ${errorMessage}`);
      }

      const tokenData: AccessTokenResponse = await response.json();
      
      // Cache the token (expire 5 minutes before actual expiry for safety)
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = Date.now() + (tokenData.expires_in - 300) * 1000;

      return this.accessToken;
    } catch (error: any) {
      // Only log if not already logged above
      if (!error.message?.includes('Failed to get access token')) {
        this.logger.error('Failed to acquire Microsoft 365 access token', {
          metadata: {
            error: error.message || 'Unknown error',
            errorType: error.constructor?.name || 'Unknown',
            stack: error.stack
          }
        } as any);
      }
      throw error;
    }
  }

  /**
   * Check if the service is properly configured
   */
  get configured(): boolean {
    return this.isConfigured && this.graphClient !== null;
  }

  /**
   * Send an email using Microsoft Graph API
   * 
   * @param options Email options
   * @returns Promise<boolean> True if email was sent successfully
   */
  async sendEmail(options: Microsoft365EmailOptions): Promise<boolean> {
    if (!this.configured || !this.graphClient) {
      throw new Error('Microsoft 365 email service is not configured');
    }

    const fromEmail = options.from || this.fromEmail;
    const toEmail = options.to;

    // Validate email addresses
    if (!this.isValidEmail(fromEmail)) {
      throw new Error(`Invalid from email address: ${fromEmail}`);
    }

    if (!this.isValidEmail(toEmail)) {
      throw new Error(`Invalid to email address: ${toEmail}`);
    }

    try {
      // Prepare the email message
      const message = {
        message: {
          subject: options.subject,
          body: {
            contentType: 'HTML',
            content: options.html
          },
          toRecipients: [
            {
              emailAddress: {
                address: toEmail
              }
            }
          ]
        },
        saveToSentItems: true // Save a copy to sent items
      };

      // Send email using Microsoft Graph API
      // The API endpoint format is: /users/{userPrincipalName}/sendMail
      // where userPrincipalName is the email address of the mailbox
      const endpoint = `/users/${encodeURIComponent(fromEmail)}/sendMail`;

      await this.graphClient.api(endpoint).post(message);

      this.logger.info('Email sent successfully via Microsoft 365', {
        metadata: {
          from: fromEmail,
          to: toEmail,
          subject: options.subject
        }
      } as any);

      return true;
    } catch (error: any) {
      // Microsoft Graph Client library error structure
      const statusCode = error.statusCode || error.code || (error.response?.status) || 'UNKNOWN';
      const errorBody = error.body || error.response?.body || error.response?.data || {};
      const graphError = errorBody.error || {};
      const errorMessage = graphError.message || error.message || 'Unknown error';
      const errorCode = graphError.code || statusCode;

      this.logger.error('Failed to send email via Microsoft 365', {
        metadata: {
          error: errorMessage,
          errorCode: statusCode,
          graphErrorCode: errorCode,
          from: fromEmail,
          to: toEmail,
          fullError: error
        }
      } as any);

      // Provide more helpful error messages based on status code
      if (statusCode === 401 || errorMessage.includes('Unauthorized') || errorMessage.includes('AADSTS')) {
        throw new Error('Microsoft 365 authentication failed. Please check your credentials and permissions.');
      } else if (statusCode === 403 || errorMessage.includes('Forbidden') || errorMessage.includes('AccessDenied')) {
        throw new Error('Microsoft 365 access denied. Please verify Mail.Send permission is granted and Application Access Policy allows this mailbox.');
      } else if (statusCode === 404 || errorMessage.includes('NotFound') || errorMessage.includes('ResourceNotFound')) {
        throw new Error(`Microsoft 365 mailbox not found: ${fromEmail}. Please verify the mailbox exists.`);
      } else if (statusCode === 429 || errorMessage.includes('TooManyRequests')) {
        throw new Error('Microsoft 365 rate limit exceeded. Please try again later.');
      } else {
        throw new Error(`Microsoft 365 email send failed (${statusCode}): ${errorMessage}`);
      }
    }
  }

  /**
   * Validate email address format
   */
  private isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Health check for Microsoft 365 email service
   * Attempts to verify the service is working by checking authentication
   */
  async healthCheck(): Promise<boolean> {
    if (!this.configured || !this.graphClient) {
      return false;
    }

    try {
      // Try to get the user information for the from email
      // This validates that authentication is working
      const userEndpoint = `/users/${encodeURIComponent(this.fromEmail)}`;
      await this.graphClient.api(userEndpoint).get();
      return true;
    } catch (error: any) {
      this.logger.warn('Microsoft 365 email service health check failed', {
        metadata: {
          error: error.message || 'Unknown error'
        }
      } as any);
      return false;
    }
  }
}

// Export singleton instance
export const microsoft365EmailService = new Microsoft365EmailService();

