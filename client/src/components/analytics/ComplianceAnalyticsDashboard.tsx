
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Users, 
  FileText,
  Shield,
  BarChart3,
  Activity,
  Target,
  Brain,
  Zap,
  Calendar,
  Settings,
  RefreshCw
} from 'lucide-react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, BarChart, Bar, PieChart, Pie, Cell, Area, AreaChart } from 'recharts';
import PredictiveInsights from './PredictiveInsights';
import { apiGet } from '@/api';

interface ComplianceKPIs {
  templateUsageRate: number;
  templateCustomizationFrequency: number;
  trainingCompletionRate: number;
  auditPassRate: number;
  incidentResolutionTime: number;
  userSatisfactionScore: number;
  complianceScore: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  targets?: {
    templateUsageRate: number;
    trainingCompletionRate: number;
    auditPassRate: number;
    userSatisfactionScore: number;
    userEngagement: number;
    systemUptime: number;
    incidentResolutionTime: number;
  };
}

interface DashboardMetrics {
  realTimeMetrics: {
    activeUsers: number;
    documentsCreated: number;
    assessmentsInProgress: number;
    complianceAlerts: number;
    systemHealth: number;
  };
  complianceOverview: {
    overallScore: number;
    criticalIssues: number;
    completedAudits: number;
    pendingActions: number;
    certificationsActive: number;
  };
  performanceMetrics: {
    averageCompletionTime: number;
    documentProcessingRate: number;
    userEngagement: number;
    systemUptime: number;
    errorRate: number;
  };
  targets?: {
    userEngagement: number;
    systemUptime: number;
  };
}

interface ComplianceAnalyticsDashboardProps {
  userRole: 'admin' | 'compliance' | 'auditor' | 'user';
}

export function ComplianceAnalyticsDashboard({ userRole }: ComplianceAnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState('30d');
  const [refreshInterval, setRefreshInterval] = useState(30000);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(['kpis', 'realtime', 'compliance']);

  // Fetch compliance KPIs
  const { data: kpis, isLoading: kpisLoading, error: kpisError, refetch: refetchKPIs } = useQuery({
    queryKey: ['compliance-kpis', timeRange],
    queryFn: async () => {
      try {
        return await apiGet(`/api/analytics/compliance/kpis?timeRange=${timeRange}`);
      } catch (error) {
        console.error('Error fetching compliance KPIs:', error);
        // Return default values instead of throwing
        return {
          templateUsageRate: 0,
          templateCustomizationFrequency: 0,
          trainingCompletionRate: 0,
          auditPassRate: 0,
          incidentResolutionTime: 24,
          userSatisfactionScore: 80,
          complianceScore: 0,
          riskLevel: 'medium' as const
        };
      }
    },
    refetchInterval: refreshInterval,
    staleTime: 10000,
    retry: 1
  });

  // Fetch dashboard metrics
  const { data: dashboardMetrics, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: async () => {
      try {
        return await apiGet('/api/analytics/compliance/dashboard-metrics');
      } catch (error) {
        console.error('Error fetching dashboard metrics:', error);
        // Return default values instead of throwing
        return {
          realTimeMetrics: {
            activeUsers: 0,
            documentsCreated: 0,
            assessmentsInProgress: 0,
            complianceAlerts: 0,
            systemHealth: 100
          },
          complianceOverview: {
            overallScore: 0,
            criticalIssues: 0,
            completedAudits: 0,
            pendingActions: 0,
            certificationsActive: 0
          },
          performanceMetrics: {
            averageCompletionTime: 0,
            documentProcessingRate: 0,
            userEngagement: 0,
            systemUptime: 99.9,
            errorRate: 0.1
          }
        };
      }
    },
    refetchInterval: refreshInterval,
    retry: 1
  });

  // Fetch predictive insights
  const { data: insights, isLoading: insightsLoading, error: insightsError } = useQuery({
    queryKey: ['predictive-insights'],
    queryFn: async () => {
      try {
        return await apiGet('/api/analytics/compliance/predictive-insights');
      } catch (error) {
        console.error('Error fetching predictive insights:', error);
        // Return default values instead of throwing
        return {
          insights: {
            anomalies: [],
            riskAssessment: {
              overallRisk: 0,
              complianceGaps: [],
              predictions: []
            },
            resourceForecasting: {
              staffingNeeds: {
                current: 0,
                predicted: 0,
                roles: []
              },
              trainingRequirements: []
            },
            trendAnalysis: {
              documentTrends: [],
              complianceTrends: []
            }
          },
          trends: []
        };
      }
    },
    refetchInterval: refreshInterval * 2,
    retry: 1
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'low': return 'text-green-600 bg-green-100 border-green-300';
      case 'medium': return 'text-yellow-600 bg-yellow-100 border-yellow-300';
      case 'high': return 'text-orange-600 bg-orange-100 border-orange-300';
      case 'critical': return 'text-red-600 bg-red-100 border-red-300';
      default: return 'text-gray-600 bg-gray-100 border-gray-300';
    }
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'templates': return <FileText className="h-4 w-4" />;
      case 'training': return <Users className="h-4 w-4" />;
      case 'audit': return <CheckCircle className="h-4 w-4" />;
      case 'incidents': return <AlertTriangle className="h-4 w-4" />;
      case 'satisfaction': return <Target className="h-4 w-4" />;
      case 'compliance': return <Shield className="h-4 w-4" />;
      default: return <BarChart3 className="h-4 w-4" />;
    }
  };

  const getTrendIcon = (value: number, target: number) => {
    if (value >= target) return <TrendingUp className="h-4 w-4 text-green-600" />;
    return <TrendingDown className="h-4 w-4 text-red-600" />;
  };

  // Role-based visibility
  const isVisible = (section: string) => {
    switch (userRole) {
      case 'admin':
        return true;
      case 'compliance':
        return ['kpis', 'compliance', 'predictive'].includes(section);
      case 'auditor':
        return ['kpis', 'compliance', 'audit'].includes(section);
      default:
        return ['kpis', 'realtime'].includes(section);
    }
  };

  // Show loading state only if all queries are loading
  if (kpisLoading && metricsLoading && insightsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading compliance analytics...</span>
      </div>
    );
  }

  // Show warning if there are errors but still render the dashboard with available data
  const hasErrors = kpisError || metricsError || insightsError;

  return (
    <div className="space-y-6 p-6">
      {/* Show warning if there are errors */}
      {hasErrors && (
        <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-600">
            Some analytics data may be incomplete. Displaying available information.
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BarChart3 className="h-8 w-8 text-primary" />
            Compliance Analytics Dashboard
          </h1>
          <p className="text-muted-foreground mt-2">
            Comprehensive insights into compliance performance and predictive analytics
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="1y">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              refetchKPIs();
              window.location.reload();
            }}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="kpis">KPIs</TabsTrigger>
          <TabsTrigger value="predictive">Predictive</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Real-time Metrics */}
          {isVisible('realtime') && dashboardMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                  <Activity className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.realTimeMetrics.activeUsers}</div>
                  <p className="text-xs text-muted-foreground">Currently online</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Documents Created</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.realTimeMetrics.documentsCreated}</div>
                  <p className="text-xs text-muted-foreground">Last 24 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Assessments Active</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.realTimeMetrics.assessmentsInProgress}</div>
                  <p className="text-xs text-muted-foreground">In progress</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Compliance Alerts</CardTitle>
                  <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.realTimeMetrics.complianceAlerts}</div>
                  <p className="text-xs text-muted-foreground">Requiring attention</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">System Health</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardMetrics.realTimeMetrics.systemHealth}%</div>
                  <Progress value={dashboardMetrics.realTimeMetrics.systemHealth} className="mt-2" />
                </CardContent>
              </Card>
            </div>
          )}

          {/* Compliance Overview */}
          {isVisible('compliance') && dashboardMetrics && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5" />
                  Compliance Overview
                </CardTitle>
                <CardDescription>
                  High-level compliance status and key metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary">
                      {dashboardMetrics.complianceOverview.overallScore}%
                    </div>
                    <p className="text-sm text-muted-foreground">Overall Score</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">
                      {dashboardMetrics.complianceOverview.criticalIssues}
                    </div>
                    <p className="text-sm text-muted-foreground">Critical Issues</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">
                      {dashboardMetrics.complianceOverview.completedAudits}
                    </div>
                    <p className="text-sm text-muted-foreground">Completed Audits</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600">
                      {dashboardMetrics.complianceOverview.pendingActions}
                    </div>
                    <p className="text-sm text-muted-foreground">Pending Actions</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600">
                      {dashboardMetrics.complianceOverview.certificationsActive}
                    </div>
                    <p className="text-sm text-muted-foreground">Active Certifications</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="kpis" className="space-y-6">
          {/* KPI Cards */}
          {kpis ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Template Usage Rate</CardTitle>
                  {getMetricIcon('templates')}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.templateUsageRate}%</div>
                  <div className="flex items-center mt-2">
                    {getTrendIcon(kpis.templateUsageRate, kpis.targets?.templateUsageRate || 80)}
                    <p className="text-xs text-muted-foreground ml-1">
                      Target: {kpis.targets?.templateUsageRate || 80}%
                    </p>
                  </div>
                  <Progress value={kpis.templateUsageRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Training Completion</CardTitle>
                  {getMetricIcon('training')}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.trainingCompletionRate}%</div>
                  <div className="flex items-center mt-2">
                    {getTrendIcon(kpis.trainingCompletionRate, kpis.targets?.trainingCompletionRate || 90)}
                    <p className="text-xs text-muted-foreground ml-1">
                      Target: {kpis.targets?.trainingCompletionRate || 90}%
                    </p>
                  </div>
                  <Progress value={kpis.trainingCompletionRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Audit Pass Rate</CardTitle>
                  {getMetricIcon('audit')}
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{kpis.auditPassRate}%</div>
                  <div className="flex items-center mt-2">
                    {getTrendIcon(kpis.auditPassRate, kpis.targets?.auditPassRate || 85)}
                    <p className="text-xs text-muted-foreground ml-1">
                      Target: {kpis.targets?.auditPassRate || 85}%
                    </p>
                  </div>
                  <Progress value={kpis.auditPassRate} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Overall Risk Level</CardTitle>
                  <Shield className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <Badge 
                    className={`text-sm font-medium ${getRiskColor(kpis.riskLevel)}`}
                    variant="outline"
                  >
                    {kpis.riskLevel.toUpperCase()}
                  </Badge>
                  <div className="text-2xl font-bold mt-2">{kpis.complianceScore}%</div>
                  <p className="text-xs text-muted-foreground">Compliance Score</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No KPI data available
            </div>
          )}

          {/* Detailed KPI Metrics */}
          {kpis && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Incident Resolution Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-3xl font-bold">{kpis.incidentResolutionTime}h</div>
                      <p className="text-sm text-muted-foreground">Average Resolution Time</p>
                    </div>
                    <Clock className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Target: {kpis.targets?.incidentResolutionTime || 24}h</span>
                      <span className={kpis.incidentResolutionTime <= (kpis.targets?.incidentResolutionTime || 24) ? 'text-green-600' : 'text-red-600'}>
                        {kpis.incidentResolutionTime <= (kpis.targets?.incidentResolutionTime || 24) ? 'On Target' : 'Above Target'}
                      </span>
                    </div>
                    <Progress 
                      value={Math.min((24 / kpis.incidentResolutionTime) * 100, 100)} 
                      className="h-2" 
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>User Satisfaction</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-3xl font-bold">{kpis.userSatisfactionScore}%</div>
                      <p className="text-sm text-muted-foreground">Satisfaction Score</p>
                    </div>
                    <Target className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>Target: {kpis.targets?.userSatisfactionScore || 85}%</span>
                      <span className={kpis.userSatisfactionScore >= (kpis.targets?.userSatisfactionScore || 85) ? 'text-green-600' : 'text-yellow-600'}>
                        {kpis.userSatisfactionScore >= (kpis.targets?.userSatisfactionScore || 85) ? 'Excellent' : 'Good'}
                      </span>
                    </div>
                    <Progress value={kpis.userSatisfactionScore} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="predictive" className="space-y-6">
          {insights && <PredictiveInsights assessmentId="" insights={insights.insights} trends={insights.trends} />}
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Metrics */}
          {dashboardMetrics && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Completion Times
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {dashboardMetrics.performanceMetrics.averageCompletionTime}h
                  </div>
                  <p className="text-sm text-muted-foreground">Average Assessment Time</p>
                  <Progress 
                    value={Math.min((8 / dashboardMetrics.performanceMetrics.averageCompletionTime) * 100, 100)} 
                    className="mt-4" 
                  />
                  <p className="text-xs text-muted-foreground mt-2">Target: 8 hours</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    User Engagement
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {dashboardMetrics.performanceMetrics.userEngagement}%
                  </div>
                  <p className="text-sm text-muted-foreground">Engagement Rate</p>
                  <Progress value={dashboardMetrics.performanceMetrics.userEngagement} className="mt-4" />
                  <p className="text-xs text-muted-foreground mt-2">Target: {dashboardMetrics.targets?.userEngagement || 80}%</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Uptime
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    {dashboardMetrics.performanceMetrics.systemUptime}%
                  </div>
                  <p className="text-sm text-muted-foreground">System Availability</p>
                  <Progress value={dashboardMetrics.performanceMetrics.systemUptime} className="mt-4" />
                  <p className="text-xs text-muted-foreground mt-2">Target: {dashboardMetrics.targets?.systemUptime || 99.9}%</p>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* Actionable Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5" />
                Actionable Insights & Recommendations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {kpis && kpis.templateUsageRate < (kpis.targets?.templateUsageRate || 80) && (
                  <Alert>
                    <Target className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Template Usage Below Target:</strong> Current usage rate is {kpis.templateUsageRate}%. 
                      Consider providing additional training on template benefits and usage.
                    </AlertDescription>
                  </Alert>
                )}

                {kpis && kpis.auditPassRate < (kpis.targets?.auditPassRate || 85) && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Audit Performance Needs Attention:</strong> Pass rate is {kpis.auditPassRate}%. 
                      Review failed assessments and implement targeted improvements.
                    </AlertDescription>
                  </Alert>
                )}

                {kpis && kpis.riskLevel !== 'low' && (
                  <Alert variant="destructive">
                    <Shield className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Elevated Risk Level:</strong> Current risk level is {kpis.riskLevel}. 
                      Immediate action required to address compliance gaps.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default ComplianceAnalyticsDashboard;
