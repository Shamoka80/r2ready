import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { 
  Plus, 
  FileText, 
  Users, 
  Building2, 
  Settings, 
  Search,
  Bell,
  ChevronDown,
  Download,
  Eye,
  Play,
  MoreHorizontal,
  LogOut,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { apiGet } from '@/api';
import { 
  KPICard, 
  ReadinessGauge, 
  GapAnalysisWidget, 
  ActivityFeed, 
  DeadlineList,
  CoreRequirementsChart
} from '@/components/dashboard/DashboardWidgets';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

interface DashboardKPIs {
  totalAssessments: number;
  inProgress: number;
  completed: number;
  needsReview: number;
  averageReadiness: number;
  certificationReady: number;
  criticalGaps: number;
  facilities: number;
}

interface ReadinessSnapshot {
  overallScore: number;
  readinessLevel: 'Not Ready' | 'Needs Work' | 'Approaching Ready' | 'Certification Ready';
  coreRequirements: {
    cr1: number;
    cr2: number;
    cr3: number;
    cr4: number;
    cr5: number;
    cr6: number;
    cr7: number;
    cr8: number;
    cr9: number;
    cr10: number;
  };
  appendices: {
    appA: number;
    appB: number;
    appC: number;
    appD: number;
    appE: number;
    appF: number;
    appG: number;
  };
  gapBreakdown: {
    critical: number;
    important: number;
    minor: number;
  };
}

interface ActivityEvent {
  id: string;
  type: string;
  description: string;
  userName?: string;
  timestamp: Date;
}

interface Deadline {
  id: string;
  title: string;
  type: string;
  dueDate: Date;
  priority: 'high' | 'medium' | 'low';
  status: 'upcoming' | 'due_soon' | 'overdue';
}

interface DashboardOverview {
  kpis: DashboardKPIs;
  readiness: ReadinessSnapshot;
  activities: ActivityEvent[];
  deadlines: Deadline[];
}

interface Assessment {
  id: string;
  title: string;
  status: string;
  progress: number;
  updatedAt: string;
  facilityId?: string;
}

function Dashboard() {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const [location, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch dashboard overview
  const { data: dashboardResponse, isLoading: dashboardLoading } = useQuery<{ 
    success: boolean; 
    dashboard: DashboardOverview; 
    dashboardType?: 'business' | 'consultant' 
  }>({
    queryKey: ['/api/dashboard/overview'],
    retry: 2,
  });
  
  const dashboardData = dashboardResponse?.success ? dashboardResponse.dashboard : undefined;
  const dashboardType = dashboardResponse?.dashboardType || 'business';

  // Redirect to consultant dashboard if this is a consultant user
  if (dashboardType === 'consultant') {
    window.location.href = '/consultant-dashboard';
    return <div>Redirecting to consultant dashboard...</div>;
  }

  // Fetch assessments for the table
  const { data: assessmentsData, isLoading: assessmentsLoading } = useQuery<Assessment[]>({
    queryKey: ['/api/assessments'],
    retry: 2,
  });
  
  // Ensure assessments is always an array
  const allAssessments = Array.isArray(assessmentsData) ? assessmentsData : [];

  // Filter assessments based on search query
  const assessments = useMemo(() => {
    if (!searchQuery.trim()) {
      return allAssessments;
    }
    const query = searchQuery.toLowerCase();
    return allAssessments.filter((assessment) => 
      assessment.title?.toLowerCase().includes(query) ||
      assessment.status?.toLowerCase().includes(query) ||
      assessment.id?.toLowerCase().includes(query)
    );
  }, [allAssessments, searchQuery]);

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'outline' | 'destructive', label: string }> = {
      'COMPLETED': { variant: 'default', label: 'Completed' },
      'IN_PROGRESS': { variant: 'secondary', label: 'In Progress' },
      'DRAFT': { variant: 'outline', label: 'Draft' },
      'UNDER_REVIEW': { variant: 'secondary', label: 'Under Review' },
      'NEEDS_REVIEW': { variant: 'destructive', label: 'Needs Review' },
    };
    const config = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={config.variant} data-testid={`status-${status.toLowerCase()}`}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header Bar */}
      <div className="border-b bg-card sticky top-0 z-10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-4 flex-1 w-full sm:w-auto">
            <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
            <div className="relative max-w-md flex-1 hidden md:block">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search facilities, users, or assessments..." 
                className="pl-10 pr-10"
                data-testid="input-global-search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    // If Enter is pressed, you could navigate to a search results page
                    // For now, just keep the filtered results visible
                    e.preventDefault();
                  }
                }}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-6 w-6"
                  onClick={() => setSearchQuery('')}
                  data-testid="button-clear-search"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-end">
            <Button variant="outline" size="icon" data-testid="button-notifications" className="h-9 w-9 sm:h-10 sm:w-10">
              <Bell className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-quick-add" className="h-9 sm:h-10">
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Quick Add</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocation('/facilities?new=true')}>
                  <Building2 className="h-4 w-4 mr-2" />
                  New Facility
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/assessments/new')}>
                  <FileText className="h-4 w-4 mr-2" />
                  New Assessment
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/team?invite=true')}>
                  <Users className="h-4 w-4 mr-2" />
                  Invite User
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="button-user-menu" className="h-9 sm:h-10">
                  <span className="hidden sm:inline mr-2">{user?.firstName || 'User'}</span>
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  <Settings className="h-4 w-4 mr-2" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={() => {
                    logout();
                    setLocation('/');
                  }}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Welcome Context */}
        <Card data-testid="welcome-card">
          <CardHeader>
            <CardTitle className="text-2xl">
              Welcome back, {user?.firstName || 'User'}!
            </CardTitle>
            <CardDescription>
              Here's your certification readiness overview
            </CardDescription>
          </CardHeader>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title="Total Assessments"
            value={dashboardData?.kpis.totalAssessments || 0}
            icon={<FileText className="h-4 w-4" />}
            isLoading={dashboardLoading}
          />
          <KPICard
            title="In Progress"
            value={dashboardData?.kpis.inProgress || 0}
            description="Active assessments"
            icon={<FileText className="h-4 w-4" />}
            isLoading={dashboardLoading}
          />
          <KPICard
            title="Average Readiness"
            value={`${dashboardData?.kpis.averageReadiness || 0}%`}
            icon={<FileText className="h-4 w-4" />}
            isLoading={dashboardLoading}
          />
          <KPICard
            title="Facilities"
            value={dashboardData?.kpis.facilities || 0}
            icon={<Building2 className="h-4 w-4" />}
            isLoading={dashboardLoading}
          />
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Left Column - Readiness & Gaps */}
          <div className="space-y-4 sm:space-y-6">
            <ReadinessGauge
              score={dashboardData?.readiness.overallScore || 0}
              level={dashboardData?.readiness.readinessLevel || 'Not Ready'}
              isLoading={dashboardLoading}
            />
            <GapAnalysisWidget
              critical={dashboardData?.readiness.gapBreakdown.critical || 0}
              important={dashboardData?.readiness.gapBreakdown.important || 0}
              minor={dashboardData?.readiness.gapBreakdown.minor || 0}
              isLoading={dashboardLoading}
            />
          </div>

          {/* Middle Column - Core Requirements */}
          <div className="lg:col-span-2">
            <CoreRequirementsChart
              scores={dashboardData?.readiness.coreRequirements || {
                cr1: 0, cr2: 0, cr3: 0, cr4: 0, cr5: 0,
                cr6: 0, cr7: 0, cr8: 0, cr9: 0, cr10: 0,
              }}
              isLoading={dashboardLoading}
            />
          </div>
        </div>

        {/* Saved Assessments Table */}
        <Card data-testid="assessments-table">
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div>
                <CardTitle className="text-lg sm:text-xl">Saved Assessments</CardTitle>
                <CardDescription className="text-sm">All your assessments in one place</CardDescription>
              </div>
              <Link href="/assessments/new" className="w-full sm:w-auto">
                <Button data-testid="button-start-new-assessment" className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  <span className="hidden sm:inline">Start New Assessment</span>
                  <span className="sm:hidden">START NEW</span>
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {assessmentsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : assessments.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground mb-4 text-sm sm:text-base">No assessments yet</p>
                <Link href="/assessments/new">
                  <Button data-testid="button-create-first-assessment" className="w-full sm:w-auto">
                    Create Your First Assessment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[150px]">Assessment Name</TableHead>
                      <TableHead className="hidden sm:table-cell">Status</TableHead>
                      <TableHead className="hidden md:table-cell">Progress</TableHead>
                      <TableHead className="hidden lg:table-cell">Last Updated</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {assessments.slice(0, 10).map((assessment) => (
                      <TableRow key={assessment.id} data-testid={`assessment-row-${assessment.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex flex-col gap-1">
                            <span>{assessment.title}</span>
                            <div className="flex items-center gap-2 sm:hidden">
                              {getStatusBadge(assessment.status)}
                              <span className="text-xs text-muted-foreground">
                                {format(new Date(assessment.updatedAt), 'MMM d, yyyy')}
                              </span>
                            </div>
                            <div className="flex items-center gap-2 md:hidden lg:hidden sm:flex">
                              <div className="flex-1 bg-muted rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all"
                                  style={{ width: `${assessment.progress || 0}%` }}
                                />
                              </div>
                              <span className="text-xs text-muted-foreground">{assessment.progress || 0}%</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">{getStatusBadge(assessment.status)}</TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-muted rounded-full h-2">
                              <div 
                                className="bg-primary h-2 rounded-full transition-all"
                                style={{ width: `${assessment.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground">{assessment.progress || 0}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {format(new Date(assessment.updatedAt), 'MMM d, yyyy')}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" data-testid={`button-actions-${assessment.id}`}>
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/assessments/${assessment.id}`}>
                                  <Play className="h-4 w-4 mr-2" />
                                  {assessment.status === 'COMPLETED' ? 'View' : 'Resume'}
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Report
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity & Deadlines */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          <ActivityFeed
            activities={dashboardData?.activities || []}
            isLoading={dashboardLoading}
          />
          <DeadlineList
            deadlines={dashboardData?.deadlines || []}
            isLoading={dashboardLoading}
          />
        </div>

        {/* Quick Actions */}
        <Card data-testid="quick-actions-card">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks and shortcuts</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Link href="/facilities">
                <Button variant="outline" className="w-full justify-start" data-testid="button-manage-facilities">
                  <Building2 className="h-4 w-4 mr-2" />
                  Manage Facilities
                </Button>
              </Link>
              <Link href="/team">
                <Button variant="outline" className="w-full justify-start" data-testid="button-manage-team">
                  <Users className="h-4 w-4 mr-2" />
                  Manage Team
                </Button>
              </Link>
              <Link href="/reports">
                <Button variant="outline" className="w-full justify-start" data-testid="button-view-reports">
                  <FileText className="h-4 w-4 mr-2" />
                  View Reports
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default Dashboard;
