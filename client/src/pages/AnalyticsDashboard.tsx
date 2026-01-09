
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Alert, AlertDescription } from '../components/ui/alert';
import { 
  Activity, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle,
  Clock,
  Users,
  Shield,
  BarChart3,
  TrendingDown,
  FileText,
  Target
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Bar, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import ComplianceAnalyticsDashboard from '../components/analytics/ComplianceAnalyticsDashboard';
import { useAuth } from '@/contexts/AuthContext';
import { apiGet } from '@/api';

interface PerformanceMetrics {
  totalRequests: number;
  averageResponseTime: number;
  errorRate: number;
  slowestOperations: Array<{
    operation: string;
    averageTime: number;
    count: number;
  }>;
  timeRange: string;
}

interface SecurityMetrics {
  suspiciousActivities: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
  failedLogins: number;
  bruteForceAttempts: number;
  timeRange: string;
}

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  timestamp: string;
  checks: Record<string, {
    status: 'pass' | 'fail' | 'warn';
    message?: string;
    duration?: number;
  }>;
}

interface OnboardingAnalytics {
  summary: {
    totalSessions: number;
    completedSessions: number;
    completionRate: number;
    stepAbandonments: Record<string, number>;
    avgStepTimes: Record<string, number>;
    accountTypeBreakdown: Record<string, number>;
  };
  lastUpdated: string;
}

interface RealtimePerformanceMetrics {
  current: {
    averageResponseTime: number;
    uptimePercentage: number;
    errorRate: number;
    performanceScore: number;
  };
  recommendations?: string[];
}

interface ComplianceAnalytics {
  current: {
    overallComplianceRate: number;
    riskDistribution: Record<string, number>;
  };
  trends: {
    trend: 'up' | 'down' | 'stable';
  };
  insights: {
    improvementOpportunities: number;
  };
}

interface UserActivity {
  current: {
    activeUsers: number;
    totalActions: number;
  };
  insights: {
    peakUsageTime: string;
    engagementLevel: 'high' | 'medium' | 'low';
  };
}

export default function AnalyticsDashboard() {
  const { user } = useAuth();
  const [performanceData, setPerformanceData] = useState<PerformanceMetrics | null>(null);
  const [securityData, setSecurityData] = useState<SecurityMetrics | null>(null);
  const [healthData, setHealthData] = useState<SystemHealth | null>(null);
  const [onboardingData, setOnboardingData] = useState<OnboardingAnalytics | null>(null);
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState('overview');

  // Use useQuery for fetching analytics data
  const { data: analytics, isLoading: isAssessmentLoading, error: assessmentError } = useQuery({
    queryKey: ['analytics', 'assessments', timeRange],
    queryFn: () => apiGet(`/api/analytics/assessments?timeRange=${timeRange}`),
    refetchInterval: 30000,
    staleTime: 10000,
    retry: 1, // Only retry once on failure
    retryDelay: 1000
  });

  // Get performance metrics
  const { data: performanceMetrics, isLoading: performanceLoading, error: performanceError } = useQuery<RealtimePerformanceMetrics>({
    queryKey: ['analytics', 'performance', timeRange],
    queryFn: async () => {
      try {
        return await apiGet(`/api/analytics/performance?timeRange=${timeRange}`);
      } catch (error) {
        console.error('Error fetching performance metrics:', error);
        // Return default values instead of throwing
        return {
          current: {
            averageResponseTime: 0,
            uptimePercentage: 100,
            errorRate: 0,
            performanceScore: 100
          },
          recommendations: []
        };
      }
    },
    refetchInterval: 60000,
    retry: 1
  });

  // Get compliance analytics
  const { data: complianceAnalytics } = useQuery<ComplianceAnalytics>({
    queryKey: ['analytics', 'compliance', timeRange],
    queryFn: () => apiGet(`/api/analytics/compliance?timeRange=${timeRange}`),
    refetchInterval: 60000
  });

  // Get user activity analytics
  const { data: userActivity } = useQuery<UserActivity>({
    queryKey: ['analytics', 'user-activity', timeRange],
    queryFn: () => apiGet(`/api/analytics/user-activity?timeRange=${timeRange}`),
    refetchInterval: 60000
  });

  // Get security analytics
  const { data: securityMetrics, isLoading: securityLoading, error: securityError } = useQuery<SecurityMetrics>({
    queryKey: ['analytics', 'security', timeRange],
    queryFn: async () => {
      try {
        return await apiGet(`/api/analytics/security?timeRange=${timeRange}`);
      } catch (error) {
        console.error('Error fetching security metrics:', error);
        // Return default values instead of throwing
        return {
          suspiciousActivities: [],
          failedLogins: 0,
          bruteForceAttempts: 0,
          timeRange: timeRange
        };
      }
    },
    refetchInterval: 60000,
    retry: 1
  });
  
  // Fetching health and onboarding data with the original approach
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        const fetchWithFallback = async (url: string, fallback: any = null) => {
          try {
            return await apiGet(url);
          } catch (error) {
            console.warn(`API call failed for ${url}:`, error);
            return fallback;
          }
        };

        const health = await fetchWithFallback('/api/observability/health', { 
          status: 'unknown', 
          checks: {} 
        });
        setHealthData(health);

        const onboarding = await fetchWithFallback('/api/analytics/onboarding/summary', null);
        setOnboardingData(onboarding);

        // Always set loading to false after attempting to fetch, regardless of results
        setLoading(false);
      } catch (err) {
        console.error('Initial analytics fetch error:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch initial analytics data');
        setLoading(false);
      }
    };

    fetchInitialData();
  }, [timeRange]);

  const getHealthStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'unhealthy': return 'text-red-600';
      default: return 'text-foreground';
    }
  };

  const getCheckStatusBadge = (status: 'pass' | 'fail' | 'warn') => {
    switch (status) {
      case 'pass': return <Badge variant="secondary" className="bg-green-500/20 text-green-400">Pass</Badge>;
      case 'fail': return <Badge variant="destructive">Fail</Badge>;
      case 'warn': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Warning</Badge>;
      default: return <Badge variant="outline">Unknown</Badge>;
    }
  };

  // Determine user role for compliance dashboard
  const getUserRole = () => {
    const role = user?.businessRole || user?.consultantRole || 'user';
    if (role === 'business_owner' || role === 'consultant_owner') return 'admin';
    if (role.includes('compliance')) return 'compliance';
    if (role.includes('audit')) return 'auditor';
    return 'user';
  };

  // Combined loading and error state
  if (isAssessmentLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-2">Loading analytics...</span>
        </div>
      </div>
    );
  }

  if (error || assessmentError) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Failed to load analytics data: {error || assessmentError?.message}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
        <div className="flex gap-2">
          {(['1h', '24h', '7d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded text-sm ${
                timeRange === range 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-muted text-foreground hover:bg-muted'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      <Tabs value={selectedTab} onValueChange={setSelectedTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="compliance">Compliance</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* System Health Overview */}
          {healthData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  System Health
                  <span className={`ml-auto ${getHealthStatusColor(healthData?.status || 'unknown')}`}>
                    {(healthData?.status || 'unknown').toUpperCase()}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {healthData?.checks && Object.entries(healthData.checks).map(([check, result]: [string, any]) => (
                    <div key={check} className="p-3 border rounded-lg">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-medium capitalize">{check.replace(/([A-Z])/g, ' $1')}</span>
                        {getCheckStatusBadge(result.status)}
                      </div>
                      {result.message && (
                        <p className="text-sm text-foreground">{result.message}</p>
                      )}
                      {result.duration && (
                        <p className="text-xs text-foreground">{result.duration}ms</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {/* Total Requests - Using analytics data */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Total Requests
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{analytics?.totalAssessments || 0}</div>
                <p className="text-xs text-foreground">Assessments ({timeRange})</p>
              </CardContent>
            </Card>

            {/* Avg Response Time - Using performanceMetrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Avg Response Time
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics ? `${performanceMetrics.current.averageResponseTime}ms` : '-'}
                </div>
                <p className="text-xs text-foreground">
                  {performanceMetrics ? 'Average response time' : 'N/A'}
                </p>
              </CardContent>
            </Card>

            {/* Error Rate - Using performanceMetrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Error Rate
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {performanceMetrics ? `${performanceMetrics.current.errorRate}%` : '-'}
                </div>
                {performanceMetrics ? (
                  <Progress value={performanceMetrics.current.errorRate} className="mt-2" />
                ) : (
                  <Progress value={0} className="mt-2" />
                )}
                {!performanceMetrics && (
                  <p className="text-xs text-foreground mt-1">N/A</p>
                )}
              </CardContent>
            </Card>

            {/* Failed Logins - Using securityMetrics */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  Failed Logins
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {securityMetrics ? securityMetrics.failedLogins : '-'}
                </div>
                <p className="text-xs text-foreground">
                  {securityMetrics ? `Last ${securityMetrics.timeRange}` : 'N/A'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Real-time Performance Metrics and Compliance Insights */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Performance Metrics */}
            {performanceMetrics && (
              <Card className="col-span-1 md:col-span-3">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="h-5 w-5" />
                    System Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">
                        {performanceMetrics.current.averageResponseTime}ms
                      </div>
                      <div className="text-sm text-muted-foreground">Avg Response Time</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {performanceMetrics.current.uptimePercentage}%
                      </div>
                      <div className="text-sm text-muted-foreground">Uptime</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">
                        {performanceMetrics.current.errorRate}%
                      </div>
                      <div className="text-sm text-muted-foreground">Error Rate</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">
                        {performanceMetrics.current.performanceScore}
                      </div>
                      <div className="text-sm text-muted-foreground">Performance Score</div>
                    </div>
                  </div>
                  {performanceMetrics.recommendations && performanceMetrics.recommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
                      <h4 className="font-semibold text-yellow-800 mb-2">Recommendations:</h4>
                      <ul className="text-sm text-yellow-700 space-y-1">
                        {performanceMetrics.recommendations.map((rec: string, index: number) => (
                          <li key={index}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Compliance Analytics */}
            {complianceAnalytics && (
              <Card className="col-span-1 md:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Compliance Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span>Overall Compliance Rate</span>
                      <div className="flex items-center gap-2">
                        <div className="text-lg font-bold">
                          {complianceAnalytics?.current?.overallComplianceRate || 0}%
                        </div>
                        {complianceAnalytics?.trends?.trend === 'up' && (
                          <TrendingUp className="h-4 w-4 text-green-500" />
                        )}
                        {complianceAnalytics?.trends?.trend === 'down' && (
                          <TrendingDown className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>

                    {complianceAnalytics?.current?.riskDistribution && (
                      <div className="space-y-2">
                        <div className="text-sm font-medium">Risk Distribution</div>
                        {Object.entries(complianceAnalytics.current.riskDistribution).map(([risk, count]) => (
                          <div key={risk} className="flex justify-between text-sm">
                            <span className="capitalize">{risk} Risk</span>
                            <span className={`font-medium ${
                              risk === 'high' ? 'text-red-600' : 
                              risk === 'medium' ? 'text-yellow-600' : 'text-green-600'
                            }`}>
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {complianceAnalytics?.insights?.improvementOpportunities && complianceAnalytics.insights.improvementOpportunities > 0 && (
                      <div className="p-3 bg-blue-500/10 rounded-lg">
                        <div className="text-sm font-medium text-blue-800">
                          Improvement Opportunity: {complianceAnalytics.insights.improvementOpportunities}% potential gain
                        </div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="compliance" className="space-y-6">
          <ComplianceAnalyticsDashboard userRole={getUserRole()} />
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {performanceLoading ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-foreground">Loading performance data...</p>
                </div>
              </CardContent>
            </Card>
          ) : performanceError ? (
            <Card>
              <CardContent className="text-center py-8">
                <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-600">
                    Some performance data may be incomplete. Displaying available information.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : performanceMetrics ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Performance Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{performanceMetrics.current.averageResponseTime}ms</div>
                      <div className="text-sm text-foreground">Avg Response Time</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-green-600">{performanceMetrics.current.uptimePercentage}%</div>
                      <div className="text-sm text-foreground">Uptime</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className={`text-3xl font-bold ${performanceMetrics.current.errorRate > 1 ? 'text-red-600' : 'text-green-600'}`}>
                        {performanceMetrics.current.errorRate}%
                      </div>
                      <div className="text-sm text-foreground">Error Rate</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className={`text-3xl font-bold ${performanceMetrics.current.performanceScore >= 90 ? 'text-green-600' : performanceMetrics.current.performanceScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                        {performanceMetrics.current.performanceScore}
                      </div>
                      <div className="text-sm text-foreground">Performance Score</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {performanceMetrics.recommendations && performanceMetrics.recommendations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Performance Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {performanceMetrics.recommendations.map((rec, index) => (
                        <Alert key={index}>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>{rec}</AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-foreground">Loading performance data...</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          {securityLoading ? (
            <Card>
              <CardContent className="text-center py-8">
                <div className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
                  <p className="text-foreground">Loading security data...</p>
                </div>
              </CardContent>
            </Card>
          ) : securityError ? (
            <Card>
              <CardContent className="text-center py-8">
                <Alert variant="default" className="bg-yellow-500/10 border-yellow-500/20">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-600">
                    Some security data may be incomplete. Displaying available information.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          ) : securityMetrics ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Security Overview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-orange-600">{securityMetrics.failedLogins}</div>
                      <div className="text-sm text-foreground">Failed Logins</div>
                      <p className="text-xs text-muted-foreground mt-1">Last {securityMetrics.timeRange}</p>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-red-600">{securityMetrics.bruteForceAttempts}</div>
                      <div className="text-sm text-foreground">Brute Force Attempts</div>
                      <p className="text-xs text-muted-foreground mt-1">Last {securityMetrics.timeRange}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {securityMetrics.suspiciousActivities && securityMetrics.suspiciousActivities.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Suspicious Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {securityMetrics.suspiciousActivities.map((activity, index) => (
                        <div key={index} className="flex justify-between items-center p-3 border rounded">
                          <div>
                            <div className="font-medium capitalize">{activity.type.replace(/_/g, ' ')}</div>
                            <div className="text-sm text-foreground">Severity: {activity.severity}</div>
                          </div>
                          <div className="text-lg font-bold">{activity.count}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle>Suspicious Activities</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center py-4 text-muted-foreground">
                      <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
                      <p>No suspicious activities detected</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground">No security data available.</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-6">
          {onboardingData ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Onboarding Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-blue-600">{onboardingData?.summary?.totalSessions || 0}</div>
                      <div className="text-sm text-foreground">Total Sessions</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-green-600">{onboardingData?.summary?.completedSessions || 0}</div>
                      <div className="text-sm text-foreground">Completed Sessions</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-3xl font-bold text-purple-600">{(onboardingData?.summary?.completionRate || 0).toFixed(1)}%</div>
                      <div className="text-sm text-foreground">Completion Rate</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {onboardingData?.summary?.stepAbandonments && Object.keys(onboardingData.summary.stepAbandonments).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle>Step Abandonment Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {Object.entries(onboardingData.summary.stepAbandonments).map(([step, count]) => (
                        <div key={step} className="flex justify-between items-center p-3 border rounded">
                          <div className="font-medium capitalize">{step.replace(/_/g, ' ')}</div>
                          <div className="text-lg font-bold text-orange-600">{count} abandonments</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-foreground">No onboarding data available yet</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="insights" className="space-y-6">
          {/* AI-Powered Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Actionable Insights
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {complianceAnalytics && complianceAnalytics.current.overallComplianceRate < 85 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Compliance Rate Below Target:</strong> Current rate is {complianceAnalytics.current.overallComplianceRate}%. 
                      Focus on addressing high and medium risk items to improve compliance.
                    </AlertDescription>
                  </Alert>
                )}

                {performanceMetrics && performanceMetrics.current.errorRate > 1 && (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Elevated Error Rate:</strong> System error rate is {performanceMetrics.current.errorRate}%. 
                      Review recent deployments and monitor system resources.
                    </AlertDescription>
                  </Alert>
                )}

                {userActivity && userActivity.insights.engagementLevel === 'low' && (
                  <Alert>
                    <Users className="h-4 w-4" />
                    <AlertDescription>
                      <strong>Low User Engagement:</strong> Consider improving user experience or providing additional training resources.
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
