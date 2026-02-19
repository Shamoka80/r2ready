import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation } from 'wouter';
import { 
  Users, 
  Building2, 
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Calendar,
  Plus,
  Eye,
  FileText,
  Clock,
  Target,
  Award,
  CheckCircle, // Added CheckCircle for Completed This Month metric
} from 'lucide-react';
import AddClientModal from '@/components/AddClientModal';

interface Client {
  id: string;
  legalName: string;
  hqCity: string;
  hqState: string;
  industry: string;
  serviceType: string;
  projectTimeline: string;
  organizationSize: string;
  createdAt: string;
  activeAssessments?: number; // Added for new metric
  completedThisMonth?: number; // Added for new metric
  pendingReviews?: number; // Added for new metric
}

interface ProjectMetrics {
  totalClients: number;
  activeFacilities: number;
  certifiedClients: number;
  inProgress: number;
  upcomingDeadlines: number;
  completionRate: number;
}

export default function ConsultantDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [clients, setClients] = useState<Client[]>([]);
  const [metrics, setMetrics] = useState<ProjectMetrics>({
    totalClients: 0,
    activeFacilities: 0,
    certifiedClients: 0,
    inProgress: 0,
    upcomingDeadlines: 0,
    completionRate: 0
  });
  const [loading, setLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false); // State for controlling the add client modal/form

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch clients
      const clientsResponse = await fetch('/api/client-organizations', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (clientsResponse.ok) {
        const responseData = await clientsResponse.json();
        // Handle different response formats: could be array directly, or { data: [...] }, or { clients: [...] }
        const clientsData = Array.isArray(responseData) 
          ? responseData 
          : (responseData?.data || responseData?.clients || []);
        
        // Ensure clientsData is always an array
        const safeClientsData = Array.isArray(clientsData) ? clientsData : [];
        setClients(safeClientsData);

        // Calculate metrics
        setMetrics({
          totalClients: safeClientsData.length,
          activeFacilities: safeClientsData.reduce((sum: number, client: any) => sum + (client.facilitiesCount || 0), 0),
          certifiedClients: safeClientsData.filter((client: any) => client.status === 'certified').length,
          inProgress: safeClientsData.filter((client: any) => client.status === 'in_progress').length,
          upcomingDeadlines: safeClientsData.filter((client: any) => {
            if (!client.targetCertificationDate) return false;
            const deadline = new Date(client.targetCertificationDate);
            const now = new Date();
            const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            return daysUntil <= 30 && daysUntil > 0;
          }).length,
          completionRate: safeClientsData.length > 0 ? 
            (safeClientsData.filter((client: any) => client.status === 'certified').length / safeClientsData.length) * 100 : 0
        });
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getServiceTypeLabel = (serviceType: string) => {
    const labels: { [key: string]: string } = {
      'r2_certification': 'R2 Certification',
      'compliance_audit': 'Compliance Audit',
      'gap_analysis': 'Gap Analysis',
      'ongoing_consulting': 'Ongoing Consulting',
      'other': 'Other Services'
    };
    return labels[serviceType] || serviceType;
  };

  const getTimelineLabel = (timeline: string) => {
    const labels: { [key: string]: string } = {
      'immediate': 'Immediate',
      '1-3_months': '1-3 Months',
      '3-6_months': '3-6 Months',
      '6-12_months': '6-12 Months',
      'ongoing': 'Ongoing'
    };
    return labels[timeline] || timeline;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Consultant Header with White-Label Branding */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {user?.organizationName || 'Your Consulting Practice'} Dashboard
          </h1>
          <p className="text-muted-foreground">
            Manage your clients and their R2v3 compliance assessments
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Button variant="outline" onClick={() => setLocation('/service-directory')}>
            <Building2 className="w-4 h-4 mr-2" />
            Service Directory
          </Button>
          <Button onClick={() => setShowAddClient(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Key Metrics for Consultants */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <Users className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Total Clients</p>
                <p className="text-2xl font-bold">{clients?.length || 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Active Assessments</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(clients) ? clients.reduce((acc, client) => acc + (client.activeAssessments || 0), 0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-emerald-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Completed This Month</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(clients) ? clients.reduce((acc, client) => acc + (client.completedThisMonth || 0), 0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-muted-foreground">Pending Reviews</p>
                <p className="text-2xl font-bold">
                  {Array.isArray(clients) ? clients.reduce((acc, client) => acc + (client.pendingReviews || 0), 0) : 0}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Rate */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Overall Success Rate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4">
            <Progress value={metrics.completionRate} className="flex-1" />
            <span className="text-2xl font-bold">{Math.round(metrics.completionRate)}%</span>
          </div>
          <p className="text-sm text-muted-foreground mt-2">
            Clients successfully guided to R2v3 certification
          </p>
        </CardContent>
      </Card>

      {/* Client Management Tabs */}
      <Tabs defaultValue="clients" className="w-full">
        <TabsList>
          <TabsTrigger value="clients">Client Overview</TabsTrigger>
          <TabsTrigger value="projects">Active Projects</TabsTrigger>
          <TabsTrigger value="reports">Reports & Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="clients" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Your Clients</CardTitle>
              <p className="text-sm text-muted-foreground">
                Manage your client organizations and track their certification progress
              </p>
            </CardHeader>
            <CardContent>
              {clients.length === 0 ? (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No clients added yet</h3>
                  <p className="text-muted-foreground mb-6">
                    Start by adding your first client organization to begin their R2v3 certification journey.
                  </p>
                  <Button onClick={() => setLocation('/clients')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Client
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {clients.map((client) => (
                    <div key={client.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div>
                            <h3 className="font-semibold text-lg">{client.legalName}</h3>
                            <p className="text-sm text-muted-foreground">
                              {client.hqCity}, {client.hqState} • {client.industry}
                            </p>
                            <div className="flex items-center space-x-4 mt-2">
                              <Badge variant="outline">
                                {getServiceTypeLabel(client.serviceType)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Timeline: {getTimelineLabel(client.projectTimeline)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge>Active</Badge>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => setLocation(`/clients/${client.id}`)}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Manage
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Certification Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Project tracking coming soon</h3>
                <p className="text-muted-foreground">
                  Detailed project management and progress tracking will be available in the next update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Analytics & Reporting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Advanced analytics coming soon</h3>
                <p className="text-muted-foreground">
                  Comprehensive reporting and analytics dashboard will be available in the next update.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Client Modal */}
      <AddClientModal 
        open={showAddClient} 
        onOpenChange={setShowAddClient}
        onSuccess={() => {
          setShowAddClient(false);
          fetchDashboardData(); // Refresh the dashboard data
        }}
      />
    </div>
  );
}