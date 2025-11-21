/**
 * Microsoft Graph Email Service - Production-Ready Module
 * 
 * A complete, production-ready Node.js module for sending emails via Microsoft Graph API
 * using MSAL (Microsoft Authentication Library) client credentials flow.
 * 
 * Features:
 * - MSAL client credentials flow for app-only authentication
 * - Axios-based Graph API calls
 * - Automatic retry logic for Graph throttling (429 errors)
 * - Comprehensive error logging
 * - Token caching and automatic refresh
 * - Environment variable configuration
 * 
 * Required Environment Variables:
 * - MICROSOFT_365_CLIENT_ID: Azure AD Application (Client) ID
 * - MICROSOFT_365_CLIENT_SECRET: Azure AD Client Secret
 * - MICROSOFT_365_TENANT_ID: Azure AD Directory (Tenant) ID
 * - MICROSOFT_365_FROM_EMAIL: Email address of the mailbox to send from
 * 
 * Usage:
 * ```typescript
 * import { sendConfirmationEmail, sendEmail } from './graphEmailService';
 * 
 * // Send confirmation email
 * await sendConfirmationEmail('user@example.com', 'Welcome!', '<h1>Welcome</h1>');
 * 
 * // Send custom email
 * await sendEmail({
 *   to: 'user@example.com',
 *   subject: 'Test',
 *   htmlBody: '<p>Test email</p>'
 * });
 * ```
 */

import axios, { AxiosError, AxiosInstance } from 'axios';
import { ConfidentialClientApplication, ClientCredentialRequest } from '@azure/msal-node';
import { ConsistentLogService } from './consistentLogService';

// Configuration interface
interface GraphEmailConfig {
  clientId: string;
  clientSecret: string;
  tenantId: string;
  fromEmail: string;
}

// Email options interface
export interface EmailOptions {
  to: string;
  subject: string;
  htmlBody: string;
  from?: string;
  saveToSentItems?: boolean;
}

// Retry configuration
interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableStatusCodes: number[];
}

// Default retry configuration
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000, // 1 second
  maxDelayMs: 30000, // 30 seconds
  retryableStatusCodes: [429, 500, 502, 503, 504] // Throttling and server errors
};

class GraphEmailService {
  private msalClient: ConfidentialClientApplication | null = null;
  private axiosInstance: AxiosInstance;
  private logger = ConsistentLogService.getInstance();
  private config: GraphEmailConfig | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
  private retryConfig: RetryConfig;

  constructor(retryConfig?: Partial<RetryConfig>) {
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };
    
    // Initialize axios instance with default configuration
    this.axiosInstance = axios.create({
      baseURL: 'https://graph.microsoft.com/v1.0',
      timeout: 30000, // 30 seconds
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Initialize MSAL client if credentials are available
    this.initialize();
  }

  /**
   * Initialize MSAL client and validate configuration
   */
  private initialize(): void {
    const clientId = process.env.MICROSOFT_365_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_365_CLIENT_SECRET;
    const tenantId = process.env.MICROSOFT_365_TENANT_ID;
    const fromEmail = process.env.MICROSOFT_365_FROM_EMAIL;

    // Check if all required environment variables are set
    if (!clientId || !clientSecret || !tenantId || !fromEmail) {
      const missingVars: string[] = [];
      if (!clientId) missingVars.push('MICROSOFT_365_CLIENT_ID');
      if (!clientSecret) missingVars.push('MICROSOFT_365_CLIENT_SECRET');
      if (!tenantId) missingVars.push('MICROSOFT_365_TENANT_ID');
      if (!fromEmail) missingVars.push('MICROSOFT_365_FROM_EMAIL');

      this.logger.warn('Microsoft Graph email service not configured - missing environment variables', {
        metadata: { missingVariables: missingVars }
      } as any);
      return;
    }

    try {
      // Create MSAL confidential client application
      this.msalClient = new ConfidentialClientApplication({
        auth: {
          clientId: clientId,
          clientSecret: clientSecret,
          authority: `https://login.microsoftonline.com/${tenantId}`
        }
      });

      this.config = {
        clientId,
        clientSecret,
        tenantId,
        fromEmail
      };

      this.logger.info('Microsoft Graph email service initialized successfully', {
        metadata: {
          fromEmail: fromEmail,
          tenantId: tenantId.substring(0, 8) + '...'
        }
      } as any);
    } catch (error) {
      this.logger.error('Failed to initialize Microsoft Graph email service', error as any);
      this.msalClient = null;
      this.config = null;
    }
  }

  /**
   * Check if the service is properly configured
   */
  get configured(): boolean {
    return this.msalClient !== null && this.config !== null;
  }

  /**
   * Acquire access token using MSAL client credentials flow
   */
  private async acquireAccessToken(): Promise<string> {
    if (!this.msalClient || !this.config) {
      throw new Error('Microsoft Graph email service is not configured');
    }

    // Check if we have a valid cached token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    try {
      const clientCredentialRequest: ClientCredentialRequest = {
        scopes: ['https://graph.microsoft.com/.default']
      };

      const response = await this.msalClient.acquireTokenByClientCredential(clientCredentialRequest);

      if (!response || !response.accessToken) {
        throw new Error('Failed to acquire access token: No token in response');
      }

      // Cache the token (expire 5 minutes before actual expiry for safety)
      this.accessToken = response.accessToken;
      const expiresIn = response.expiresOn ? response.expiresOn.getTime() - Date.now() : 3600000; // Default 1 hour
      this.tokenExpiry = Date.now() + expiresIn - 300000; // 5 minutes buffer

      this.logger.debug('Access token acquired successfully', {
        metadata: {
          expiresIn: Math.floor(expiresIn / 1000) + ' seconds'
        }
      } as any);

      return this.accessToken;
    } catch (error: any) {
      this.logger.error('Failed to acquire access token', {
        metadata: {
          error: error.message || 'Unknown error',
          errorCode: error.errorCode || 'UNKNOWN'
        }
      } as any);
      throw new Error(`Failed to acquire access token: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Calculate exponential backoff delay with jitter
   */
  private calculateBackoffDelay(attempt: number): number {
    const exponentialDelay = Math.min(
      this.retryConfig.baseDelayMs * Math.pow(2, attempt),
      this.retryConfig.maxDelayMs
    );
    
    // Add jitter (random value between 0 and 20% of delay)
    const jitter = Math.random() * 0.2 * exponentialDelay;
    
    return Math.floor(exponentialDelay + jitter);
  }

  /**
   * Extract retry-after header value or use calculated backoff
   */
  private getRetryDelay(error: AxiosError, attempt: number): number {
    // Check for Retry-After header (429 throttling)
    // Headers can be case-insensitive, so check both cases
    const headers = error.response?.headers || {};
    const retryAfter = headers['retry-after'] || headers['Retry-After'];
    
    if (retryAfter) {
      const retryAfterValue = Array.isArray(retryAfter) ? retryAfter[0] : retryAfter;
      const retryAfterSeconds = parseInt(String(retryAfterValue), 10);
      if (!isNaN(retryAfterSeconds) && retryAfterSeconds > 0) {
        return retryAfterSeconds * 1000; // Convert to milliseconds
      }
    }

    // Use exponential backoff
    return this.calculateBackoffDelay(attempt);
  }

  /**
   * Send email with retry logic for throttling and transient errors
   */
  private async sendEmailWithRetry(
    endpoint: string,
    payload: any,
    attempt: number = 0
  ): Promise<void> {
    try {
      // Acquire access token
      const accessToken = await this.acquireAccessToken();

      // Make API call
      await this.axiosInstance.post(endpoint, payload, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      // Success - log if this was a retry
      if (attempt > 0) {
        this.logger.info('Email sent successfully after retry', {
          metadata: {
            attempt: attempt + 1,
            endpoint
          }
        } as any);
      }
    } catch (error) {
      const axiosError = error as AxiosError;
      const statusCode = axiosError.response?.status || 0;
      const isRetryable = this.retryConfig.retryableStatusCodes.includes(statusCode);

      // Log the error
      this.logger.error('Graph API request failed', {
        metadata: {
          statusCode,
          attempt: attempt + 1,
          maxRetries: this.retryConfig.maxRetries,
          endpoint,
          error: axiosError.message,
          responseData: axiosError.response?.data
        }
      } as any);

      // Check if we should retry
      if (isRetryable && attempt < this.retryConfig.maxRetries) {
        const delay = this.getRetryDelay(axiosError, attempt);
        
        this.logger.warn('Retrying Graph API request', {
          metadata: {
            attempt: attempt + 1,
            nextAttempt: attempt + 2,
            delayMs: delay,
            statusCode
          }
        } as any);

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry the request
        return this.sendEmailWithRetry(endpoint, payload, attempt + 1);
      }

      // No more retries or non-retryable error - throw
      if (statusCode === 401) {
        // Clear cached token on auth failure
        this.accessToken = null;
        this.tokenExpiry = 0;
        throw new Error('Microsoft Graph authentication failed. Please check your credentials and permissions.');
      } else if (statusCode === 403) {
        throw new Error('Microsoft Graph access denied. Please verify Mail.Send permission is granted and Application Access Policy allows this mailbox.');
      } else if (statusCode === 404) {
        throw new Error(`Microsoft Graph mailbox not found. Please verify the mailbox exists: ${payload.message.toRecipients[0]?.emailAddress?.address || 'unknown'}`);
      } else if (statusCode === 429) {
        throw new Error(`Microsoft Graph rate limit exceeded. Retried ${attempt + 1} times. Please try again later.`);
      } else {
        const errorData = axiosError.response?.data as any;
        const errorMessage = errorData?.error?.message || axiosError.message || 'Unknown error';
        throw new Error(`Microsoft Graph email send failed (${statusCode}): ${errorMessage}`);
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
   * Send email via Microsoft Graph API
   * 
   * @param options Email options
   * @returns Promise<void>
   */
  async sendEmail(options: EmailOptions): Promise<void> {
    if (!this.configured || !this.config) {
      throw new Error('Microsoft Graph email service is not configured. Please set required environment variables.');
    }

    const fromEmail = options.from || this.config.fromEmail;
    const toEmail = options.to;

    // Validate email addresses
    if (!this.isValidEmail(fromEmail)) {
      throw new Error(`Invalid from email address: ${fromEmail}`);
    }

    if (!this.isValidEmail(toEmail)) {
      throw new Error(`Invalid to email address: ${toEmail}`);
    }

    // Prepare the email message payload
    const payload = {
      message: {
        subject: options.subject,
        body: {
          contentType: 'HTML',
          content: options.htmlBody
        },
        toRecipients: [
          {
            emailAddress: {
              address: toEmail
            }
          }
        ]
      },
      saveToSentItems: options.saveToSentItems !== false // Default to true
    };

    // Construct the Graph API endpoint
    const endpoint = `/users/${encodeURIComponent(fromEmail)}/sendMail`;

    // Log email send attempt
    this.logger.info('Sending email via Microsoft Graph', {
      metadata: {
        from: fromEmail,
        to: toEmail,
        subject: options.subject
      }
    } as any);

    try {
      // Send email with retry logic
      await this.sendEmailWithRetry(endpoint, payload);

      // Log success
      this.logger.info('Email sent successfully via Microsoft Graph', {
        metadata: {
          from: fromEmail,
          to: toEmail,
          subject: options.subject
        }
      } as any);
    } catch (error: any) {
      // Error is already logged in sendEmailWithRetry
      throw error;
    }
  }

  /**
   * Send confirmation email (convenience method)
   * 
   * @param to Recipient email address
   * @param subject Email subject
   * @param htmlBody HTML email body
   * @returns Promise<void>
   */
  async sendConfirmationEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    return this.sendEmail({
      to,
      subject,
      htmlBody,
      saveToSentItems: true
    });
  }

  /**
   * Health check - verify service is working
   */
  async healthCheck(): Promise<boolean> {
    if (!this.configured || !this.config) {
      return false;
    }

    try {
      // Try to get user information for the from email
      const accessToken = await this.acquireAccessToken();
      const endpoint = `/users/${encodeURIComponent(this.config.fromEmail)}`;
      
      await this.axiosInstance.get(endpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      return true;
    } catch (error: any) {
      this.logger.warn('Microsoft Graph email service health check failed', {
        metadata: {
          error: error.message || 'Unknown error'
        }
      } as any);
      return false;
    }
  }
}

// Create singleton instance
const graphEmailService = new GraphEmailService();

// Export convenience functions
export async function sendEmail(options: EmailOptions): Promise<void> {
  return graphEmailService.sendEmail(options);
}

export async function sendConfirmationEmail(to: string, subject: string, htmlBody: string): Promise<void> {
  return graphEmailService.sendConfirmationEmail(to, subject, htmlBody);
}

export async function healthCheck(): Promise<boolean> {
  return graphEmailService.healthCheck();
}

// Export the service class and instance for advanced usage
export { GraphEmailService, graphEmailService };
export default graphEmailService;

