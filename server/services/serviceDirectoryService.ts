
import { Request, Response } from 'express';

interface ServiceEndpoint {
  id: string;
  name: string;
  path: string;
  method: string;
  description: string;
  category: string;
  version: string;
  status: 'active' | 'deprecated' | 'maintenance';
  authentication: boolean;
  rateLimit?: string;
  examples?: {
    request?: any;
    response?: any;
  };
}

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  endpoints: ServiceEndpoint[];
}

export class ServiceDirectoryService {
  private static instance: ServiceDirectoryService;
  private services: Map<string, ServiceCategory> = new Map();

  private constructor() {
    this.initializeServiceRegistry();
  }

  static getInstance(): ServiceDirectoryService {
    if (!ServiceDirectoryService.instance) {
      ServiceDirectoryService.instance = new ServiceDirectoryService();
    }
    return ServiceDirectoryService.instance;
  }

  private initializeServiceRegistry() {
    // Authentication Services
    this.registerCategory({
      id: 'auth',
      name: 'Authentication',
      description: 'User authentication and authorization services',
      endpoints: [
        {
          id: 'auth-login',
          name: 'User Login',
          path: '/api/auth/login',
          method: 'POST',
          description: 'Authenticate user and receive JWT token',
          category: 'auth',
          version: '1.0',
          status: 'active',
          authentication: false,
          examples: {
            request: { email: 'user@example.com', password: 'password' },
            response: { success: true, token: 'jwt_token', user: {} }
          }
        },
        {
          id: 'auth-register',
          name: 'User Registration',
          path: '/api/auth/register',
          method: 'POST',
          description: 'Register new user account',
          category: 'auth',
          version: '1.0',
          status: 'active',
          authentication: false
        }
      ]
    });

    // Assessment Services
    this.registerCategory({
      id: 'assessments',
      name: 'Assessment Management',
      description: 'R2v3 assessment creation and management',
      endpoints: [
        {
          id: 'assessments-list',
          name: 'List Assessments',
          path: '/api/assessments',
          method: 'GET',
          description: 'Get paginated list of assessments',
          category: 'assessments',
          version: '1.0',
          status: 'active',
          authentication: true,
          rateLimit: '100 requests/minute'
        },
        {
          id: 'assessments-create',
          name: 'Create Assessment',
          path: '/api/assessments',
          method: 'POST',
          description: 'Create new R2v3 assessment',
          category: 'assessments',
          version: '1.0',
          status: 'active',
          authentication: true
        }
      ]
    });

    // Facility Services
    this.registerCategory({
      id: 'facilities',
      name: 'Facility Management',
      description: 'Facility information and management',
      endpoints: [
        {
          id: 'facilities-list',
          name: 'List Facilities',
          path: '/api/facilities',
          method: 'GET',
          description: 'Get facilities for current user',
          category: 'facilities',
          version: '1.0',
          status: 'active',
          authentication: true
        }
      ]
    });

    // Evidence Services
    this.registerCategory({
      id: 'evidence',
      name: 'Evidence Management',
      description: 'File upload and evidence handling',
      endpoints: [
        {
          id: 'evidence-upload',
          name: 'Upload Evidence',
          path: '/api/evidence/upload',
          method: 'POST',
          description: 'Upload evidence files for assessments',
          category: 'evidence',
          version: '1.0',
          status: 'active',
          authentication: true,
          rateLimit: '10 requests/minute'
        }
      ]
    });

    // Analytics Services
    this.registerCategory({
      id: 'analytics',
      name: 'Analytics & Reporting',
      description: 'Dashboard analytics and reporting services',
      endpoints: [
        {
          id: 'analytics-dashboard',
          name: 'Dashboard Analytics',
          path: '/api/analytics/dashboard',
          method: 'GET',
          description: 'Get dashboard analytics data',
          category: 'analytics',
          version: '1.0',
          status: 'active',
          authentication: true
        }
      ]
    });
  }

  private registerCategory(category: ServiceCategory) {
    this.services.set(category.id, category);
  }

  // Public API Methods
  getAllServices(): ServiceCategory[] {
    return Array.from(this.services.values());
  }

  getServicesByCategory(categoryId: string): ServiceCategory | undefined {
    return this.services.get(categoryId);
  }

  searchServices(query: string): ServiceEndpoint[] {
    const results: ServiceEndpoint[] = [];
    
    this.services.forEach(category => {
      category.endpoints.forEach(endpoint => {
        if (
          endpoint.name.toLowerCase().includes(query.toLowerCase()) ||
          endpoint.description.toLowerCase().includes(query.toLowerCase()) ||
          endpoint.path.includes(query)
        ) {
          results.push(endpoint);
        }
      });
    });

    return results;
  }

  getServiceHealth(): { [categoryId: string]: string } {
    const health: { [categoryId: string]: string } = {};
    
    this.services.forEach((category, categoryId) => {
      const activeCount = category.endpoints.filter(e => e.status === 'active').length;
      const totalCount = category.endpoints.length;
      health[categoryId] = `${activeCount}/${totalCount} active`;
    });

    return health;
  }

  // Express route handlers
  handleGetDirectory = (req: Request, res: Response) => {
    try {
      const services = this.getAllServices();
      res.json({
        success: true,
        timestamp: new Date().toISOString(),
        services: services,
        health: this.getServiceHealth()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve service directory'
      });
    }
  };

  handleSearchServices = (req: Request, res: Response) => {
    try {
      const query = req.query.q as string;
      if (!query) {
        return res.status(400).json({
          success: false,
          error: 'Query parameter "q" is required'
        });
      }

      const results = this.searchServices(query);
      res.json({
        success: true,
        query,
        results
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Search failed'
      });
    }
  };

  handleGetCategory = (req: Request, res: Response) => {
    try {
      const categoryId = req.params.categoryId;
      const category = this.getServicesByCategory(categoryId);
      
      if (!category) {
        return res.status(404).json({
          success: false,
          error: `Category "${categoryId}" not found`
        });
      }

      res.json({
        success: true,
        category
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve category'
      });
    }
  };
}
