
# Service Directory Documentation

## Overview

The RuR2 Service Directory provides a comprehensive catalog of all available API services, endpoints, and their specifications. It serves as a centralized registry for API discovery and documentation.

## Features

- **Centralized Service Registry**: Complete catalog of all API endpoints
- **Search Functionality**: Find services by name, description, or path
- **Category Organization**: Services grouped by functional areas
- **Health Monitoring**: Real-time service status tracking
- **Interactive Documentation**: Browseable service specifications

## API Endpoints

### Get Complete Directory
```
GET /api/directory
```
Returns all services with health status information.

### Search Services
```
GET /api/directory/search?q={query}
```
Search services by name, description, or path.

### Get Category Services
```
GET /api/directory/category/{categoryId}
```
Get all services in a specific category.

### Get Service Health
```
GET /api/directory/health
```
Get health status for all service categories.

## Service Categories

### Authentication (`auth`)
User authentication and authorization services:
- User login/logout
- Registration
- JWT token management
- 2FA operations

### Assessment Management (`assessments`)
R2v3 assessment creation and management:
- Assessment CRUD operations
- Question management
- Progress tracking
- Scoring calculations

### Facility Management (`facilities`)
Facility information and management:
- Facility CRUD operations
- Multi-facility support
- Organization management

### Evidence Management (`evidence`)
File upload and evidence handling:
- Evidence file uploads
- File management
- Evidence linking to assessments

### Analytics & Reporting (`analytics`)
Dashboard analytics and reporting services:
- Dashboard data
- Compliance reports
- Export functionality

## Usage

### Frontend Integration
The Service Directory UI is available at `/service-directory` and provides:
- Interactive service browser
- Real-time search
- Service health indicators
- Method and authentication information

### Backend Integration
```typescript
import { ServiceDirectoryService } from '../services/serviceDirectoryService';

const serviceDirectory = ServiceDirectoryService.getInstance();
const services = serviceDirectory.getAllServices();
```

## Service Registration

Services are automatically registered during application startup. Each service includes:
- **Endpoint Information**: Path, method, description
- **Status Tracking**: Active, deprecated, or maintenance
- **Authentication Requirements**: Whether auth is required
- **Rate Limiting**: Request limits and windows
- **Version Information**: API version tracking

## Health Monitoring

The service directory tracks the health of all registered services:
- Active endpoint counts
- Service availability
- Real-time status updates

## Security

- Public endpoints for discovery and documentation
- No sensitive data exposed in service listings
- Authentication requirements clearly marked
- Rate limiting information provided

---

**Last Updated**: January 15, 2025
**Version**: 1.0
**Maintained By**: API Team
