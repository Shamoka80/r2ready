
# RuR2 API Documentation

## Overview

The RuR2 API provides a comprehensive set of endpoints for managing R2v3 compliance assessments, user authentication, facility management, and reporting. All endpoints use RESTful principles with JSON payloads.

### API Features
- **Multi-tenant Architecture**: Complete tenant isolation for business and consultant accounts
- **Role-based Access Control**: Granular permissions based on user roles
- **Real-time Data Sync**: Live updates for assessment progress and collaboration
- **Advanced Analytics**: Predictive insights and compliance trend analysis
- **Comprehensive Audit Trail**: Full activity logging for compliance requirements

**Base URL:** `https://rur2.replit.app/api`

## Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```
Authorization: Bearer <jwt_token>
```

### Authentication Endpoints

#### POST /api/auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "role": "facility_admin",
    "tenantId": "tenant_456"
  }
}
```

#### POST /api/auth/register
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "organizationName": "Acme Electronics"
}
```

#### POST /api/auth/logout
Logout user and invalidate token.

#### POST /api/auth/refresh
Refresh JWT token.

## User Management

### GET /api/users/profile
Get current user profile information.

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "facility_admin",
    "isActive": true,
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

### PUT /api/users/profile
Update user profile information.

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Smith",
  "phone": "+1-555-0123"
}
```

## Facility Management

### GET /api/facilities
Get list of facilities for current user.

**Query Parameters:**
- `page` (optional): Page number (default: 1)
- `limit` (optional): Items per page (default: 10)

**Response:**
```json
{
  "success": true,
  "facilities": [
    {
      "id": "facility_123",
      "name": "Main Processing Center",
      "address": "123 Industrial Blvd",
      "city": "Portland",
      "state": "OR",
      "zipCode": "97201",
      "isActive": true
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 1,
    "totalPages": 1
  }
}
```

### POST /api/facilities
Create a new facility.

**Request Body:**
```json
{
  "name": "Secondary Processing Center",
  "address": "456 Business Ave",
  "city": "Seattle",
  "state": "WA",
  "zipCode": "98101"
}
```

### GET /api/facilities/:id
Get specific facility details.

### PUT /api/facilities/:id
Update facility information.

### DELETE /api/facilities/:id
Delete a facility.

## Assessment Management

### GET /api/assessments
Get list of assessments.

**Query Parameters:**
- `facilityId` (optional): Filter by facility
- `status` (optional): Filter by status (draft, in_progress, completed)
- `page` (optional): Page number
- `limit` (optional): Items per page

**Response:**
```json
{
  "success": true,
  "assessments": [
    {
      "id": "assessment_123",
      "title": "Q1 2024 R2v3 Assessment",
      "facilityId": "facility_123",
      "status": "in_progress",
      "completionPercentage": 65,
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### POST /api/assessments
Create a new assessment.

**Request Body:**
```json
{
  "title": "Q2 2024 R2v3 Assessment",
  "facilityId": "facility_123",
  "templateId": "template_r2v3_standard"
}
```

### GET /api/assessments/:id
Get specific assessment details including questions and answers.

### PUT /api/assessments/:id
Update assessment information.

### DELETE /api/assessments/:id
Delete an assessment.

## Questions and Answers

### GET /api/assessments/:id/questions
Get questions for a specific assessment.

**Query Parameters:**
- `section` (optional): Filter by section
- `answered` (optional): Filter by answered status

**Response:**
```json
{
  "success": true,
  "questions": [
    {
      "id": "question_123",
      "text": "Does the facility have a documented EMS policy?",
      "type": "yes_no",
      "section": "R2-1",
      "clause": "R2-1.1",
      "isRequired": true,
      "answer": {
        "id": "answer_456",
        "value": "yes",
        "notes": "Policy document attached",
        "updatedAt": "2024-01-15T10:30:00Z"
      }
    }
  ]
}
```

### POST /api/assessments/:id/answers
Submit answer for a question.

**Request Body:**
```json
{
  "questionId": "question_123",
  "value": "yes",
  "notes": "Policy document reviewed and approved",
  "evidence": ["evidence_file_789"]
}
```

### PUT /api/answers/:id
Update an existing answer.

## Evidence Management

### POST /api/evidence/upload
Upload evidence file.

**Request:** Multipart form data
- `file`: Evidence file
- `assessmentId`: Assessment ID
- `questionId`: Question ID
- `description`: File description

**Response:**
```json
{
  "success": true,
  "evidence": {
    "id": "evidence_123",
    "filename": "ems_policy.pdf",
    "originalName": "EMS Policy Document.pdf",
    "mimeType": "application/pdf",
    "size": 1048576,
    "url": "/api/evidence/download/evidence_123"
  }
}
```

### GET /api/evidence/:id
Get evidence metadata.

### GET /api/evidence/download/:id
Download evidence file.

### DELETE /api/evidence/:id
Delete evidence file.

## Reporting and Export

### POST /api/exports/assessment/:id
Generate assessment report.

**Request Body:**
```json
{
  "format": "pdf",
  "template": "standard",
  "sections": ["executive_summary", "detailed_findings", "recommendations"]
}
```

**Response:**
```json
{
  "success": true,
  "exportId": "export_123",
  "status": "processing",
  "estimatedCompletion": "2024-01-15T10:35:00Z"
}
```

### GET /api/exports/:id/status
Check export status.

### GET /api/exports/:id/download
Download completed export.

## Analytics

### GET /api/analytics/dashboard
Get dashboard analytics data.

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAssessments": 25,
    "completedAssessments": 18,
    "averageScore": 87.5,
    "criticalGaps": 3,
    "recentActivity": [
      {
        "type": "assessment_completed",
        "assessmentId": "assessment_123",
        "timestamp": "2024-01-15T10:30:00Z"
      }
    ]
  }
}
```

### GET /api/analytics/compliance-trends
Get compliance trends over time.

## Error Handling

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "Specific field error"
  }
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Validation Error
- `429` - Rate Limited
- `500` - Internal Server Error

## Rate Limiting

API endpoints are rate limited:
- Authentication endpoints: 5 requests per minute
- General endpoints: 100 requests per minute
- File upload endpoints: 10 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

## Webhooks

### POST /api/webhooks/stripe
Stripe webhook endpoint for payment processing.

### POST /api/webhooks/assessment-completed
Webhook triggered when assessment is completed.

## SDK Examples

### JavaScript/TypeScript
```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'https://rur2.replit.app/api',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

// Get assessments
const assessments = await api.get('/assessments');

// Create assessment
const newAssessment = await api.post('/assessments', {
  title: 'New Assessment',
  facilityId: 'facility_123'
});
```

### cURL Examples
```bash
# Login
curl -X POST https://rur2.replit.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'

# Get assessments
curl -X GET https://rur2.replit.app/api/assessments \
  -H "Authorization: Bearer your_jwt_token"
```

## Changelog

### Version 1.0 (2024-01-15)
- Initial API release
- Authentication and user management
- Facility management
- Assessment workflow
- Evidence management
- Basic reporting

For support, contact: api-support@rur2.com
