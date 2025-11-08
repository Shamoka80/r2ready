import { z, ZodError } from 'zod';
import { rateLimitService } from '../services/rateLimitService.js';
/**
 * Generic validation middleware factory
 * Validates request body, query, and params against provided Zod schemas
 */
export const validateRequest = (schemas) => {
    return async (req, res, next) => {
        try {
            const validatedData = {};
            // Validate request body
            if (schemas.body) {
                try {
                    validatedData.body = await schemas.body.parseAsync(req.body);
                    req.body = validatedData.body;
                }
                catch (error) {
                    if (error instanceof ZodError) {
                        res.status(400).json({
                            success: false,
                            error: 'VALIDATION_ERROR',
                            message: 'Request body validation failed',
                            details: error.errors.map(err => ({
                                field: err.path.join('.'),
                                message: err.message
                            }))
                        });
                        return;
                    }
                    throw error;
                }
            }
            // Validate query parameters
            if (schemas.query) {
                try {
                    validatedData.query = await schemas.query.parseAsync(req.query);
                    req.query = validatedData.query;
                }
                catch (error) {
                    if (error instanceof ZodError) {
                        res.status(400).json({
                            success: false,
                            error: 'VALIDATION_ERROR',
                            message: 'Query parameters validation failed',
                            details: error.errors.map(err => ({
                                field: err.path.join('.'),
                                message: err.message
                            }))
                        });
                        return;
                    }
                    throw error;
                }
            }
            // Validate URL parameters
            if (schemas.params) {
                try {
                    validatedData.params = await schemas.params.parseAsync(req.params);
                    req.params = validatedData.params;
                }
                catch (error) {
                    if (error instanceof ZodError) {
                        res.status(400).json({
                            success: false,
                            error: 'VALIDATION_ERROR',
                            message: 'URL parameters validation failed',
                            details: error.errors.map(err => ({
                                field: err.path.join('.'),
                                message: err.message
                            }))
                        });
                        return;
                    }
                    throw error;
                }
            }
            // Store validated data for use in route handlers
            req.validatedData = validatedData;
            next();
        }
        catch (error) {
            console.error('Validation middleware error:', error);
            res.status(500).json({
                success: false,
                error: 'VALIDATION_ERROR',
                message: 'Internal validation error'
            });
        }
    };
};
/**
 * Common validation schemas for reuse across routes
 */
export const commonSchemas = {
    // UUID validation
    uuid: z.string().uuid({ message: 'Must be a valid UUID' }),
    // Pagination
    pagination: z.object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(100).default(20),
        sortBy: z.string().optional(),
        sortOrder: z.enum(['asc', 'desc']).default('desc')
    }),
    // Search
    search: z.object({
        q: z.string().min(1).max(100).optional(),
        filter: z.string().optional()
    }),
    // Common ID parameters
    idParams: z.object({
        id: z.string().uuid({ message: 'Invalid ID format' })
    }),
    // Assessment ID parameters
    assessmentParams: z.object({
        assessmentId: z.string().uuid({ message: 'Invalid assessment ID format' }),
        questionId: z.string().uuid({ message: 'Invalid question ID format' }).optional()
    }),
    // Facility ID parameters
    facilityParams: z.object({
        facilityId: z.string().uuid({ message: 'Invalid facility ID format' })
    }),
    // Date range validation
    dateRange: z.object({
        startDate: z.string().datetime().optional(),
        endDate: z.string().datetime().optional()
    }).refine(data => {
        if (data.startDate && data.endDate) {
            return new Date(data.startDate) <= new Date(data.endDate);
        }
        return true;
    }, { message: 'Start date must be before end date' })
};
/**
 * Security validation schemas
 */
export const securitySchemas = {
    // File upload validation
    fileUpload: z.object({
        notes: z.string().max(1000).optional(),
        category: z.string().max(50).optional(),
        tags: z.string().max(200).optional(),
        evidenceType: z.enum(['DOCUMENT', 'IMAGE', 'VIDEO', 'CERTIFICATE', 'PROCEDURE', 'RECORD', 'OTHER']).optional()
    }),
    // User input sanitization
    sanitizedText: z.string()
        .max(1000)
        .refine(val => !/<script|javascript:|on\w+=/i.test(val), {
        message: 'Potentially harmful content detected'
    }),
    // Email validation with additional security
    secureEmail: z.string()
        .email({ message: 'Invalid email format' })
        .max(254)
        .refine(val => !val.includes('..'), { message: 'Invalid email format' })
        .refine(val => !/[<>"]/.test(val), { message: 'Email contains invalid characters' }),
    // Password validation
    password: z.string()
        .min(8, { message: 'Password must be at least 8 characters' })
        .max(128, { message: 'Password must be less than 128 characters' })
        .refine(val => /[A-Z]/.test(val), { message: 'Password must contain at least one uppercase letter' })
        .refine(val => /[a-z]/.test(val), { message: 'Password must contain at least one lowercase letter' })
        .refine(val => /[0-9]/.test(val), { message: 'Password must contain at least one number' })
        .refine(val => /[^A-Za-z0-9]/.test(val), { message: 'Password must contain at least one special character' }),
    // Phone number validation
    phoneNumber: z.string()
        .regex(/^\+?[\d\s\-\(\)\.]{10,20}$/, { message: 'Invalid phone number format' })
        .optional(),
    // URL validation
    secureUrl: z.string()
        .url({ message: 'Invalid URL format' })
        .refine(val => /^https?:\/\//.test(val), { message: 'URL must use HTTP or HTTPS protocol' })
        .optional()
};
/**
 * Business logic validation schemas
 */
export const businessSchemas = {
    // Assessment creation
    createAssessment: z.object({
        title: z.string().min(1, "Title is required").max(200).optional(),
        description: z.string().max(1000).optional(),
        stdCode: z.string().optional().default("R2V3_1"),
        intakeFormId: z.string().uuid().optional(),
        facilityId: z.string().uuid("Valid facility ID is required"),
        assignedUsers: z.array(z.string().uuid()).optional(),
    }).refine(data => {
        // Title is required unless intakeFormId is provided (for auto-generation)
        return data.title || data.intakeFormId;
    }, {
        message: "Title is required when not creating from intake form",
        path: ["title"]
    }),
    // Answer submission
    submitAnswer: z.object({
        value: z.any(), // Will be validated based on question type
        notes: securitySchemas.sanitizedText.optional(),
        confidence: z.enum(['LOW', 'MEDIUM', 'HIGH']).optional()
    }),
    // Facility creation
    createFacility: z.object({
        name: z.string().min(1).max(200),
        address: z.string().min(1).max(500),
        city: z.string().min(1).max(100),
        state: z.string().min(1).max(100),
        zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, { message: 'Invalid ZIP code format' }),
        country: z.string().length(2, { message: 'Country must be 2-letter code' }).default('US'),
        timeZone: z.string().max(50).default('America/New_York'),
        headcount: z.number().int().min(0).max(10000).optional(),
        floorArea: z.number().int().min(0).max(10000000).optional()
    }),
    // User invitation
    inviteUser: z.object({
        email: securitySchemas.secureEmail,
        role: z.enum(['business_owner', 'facility_manager', 'compliance_officer', 'team_member', 'viewer']),
        facilityIds: z.array(z.string().uuid()).optional(),
        customMessage: securitySchemas.sanitizedText.optional()
    })
};
/**
 * Rate limiting validation middleware
 * Combines validation with rate limiting for sensitive operations
 */
export const validateWithRateLimit = (schemas, rateLimitKey, rateLimitAction) => {
    return [
        async (req, res, next) => {
            // Apply rate limiting first
            const identifier = req.ip || '127.0.0.1';
            const rateLimitResult = await rateLimitService.checkRateLimit('ip', identifier, rateLimitKey, rateLimitAction, identifier, req.headers['user-agent'] || 'Unknown');
            if (!rateLimitResult.allowed) {
                return res.status(429).json({
                    success: false,
                    error: 'RATE_LIMIT_EXCEEDED',
                    message: 'Too many requests. Please try again later.',
                    retryAfter: rateLimitResult.retryAfter
                });
            }
            next();
        },
        validateRequest(schemas)
    ];
};
/**
 * Export validation middleware for easy import
 */
export const validation = {
    // Core validation
    request: validateRequest,
    // Common validations
    uuid: validateRequest({ params: commonSchemas.idParams }),
    pagination: validateRequest({ query: commonSchemas.pagination }),
    assessmentParams: validateRequest({ params: commonSchemas.assessmentParams }),
    facilityParams: validateRequest({ params: commonSchemas.facilityParams }),
    // Business validations
    createAssessment: validateRequest({ body: businessSchemas.createAssessment }),
    submitAnswer: validateRequest({ body: businessSchemas.submitAnswer }),
    createFacility: validateRequest({ body: businessSchemas.createFacility }),
    inviteUser: validateRequest({ body: businessSchemas.inviteUser }),
    // Security validations
    fileUpload: validateRequest({ body: securitySchemas.fileUpload }),
    // Rate limited validations
    withRateLimit: validateWithRateLimit
};
export default validation;
