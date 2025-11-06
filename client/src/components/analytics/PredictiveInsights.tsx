import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle,
  BarChart3,
  Target,
  Calendar,
  Users,
  Award,
  Clock
} from 'lucide-react';

interface PredictiveInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'prediction' | 'recommendation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  impact: string;
  confidence: number;
  timeframe: string;
  actionItems: string[];
  metadata: {
    dataPoints: number;
    lastUpdated: Date;
    source: string[];
  };
}

interface TrendData {
  period: string;
  value: number;
  predicted: number;
  confidence: number;
}

interface ComplianceForecast {
  currentScore: number;
  predictedScore: number;
  trend: 'improving' | 'declining' | 'stable';
  timeToTarget: number;
  riskFactors: string[];
}

export default function PredictiveInsights() {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('90d');
  const [selectedInsightType, setSelectedInsightType] = useState<'all' | 'trends' | 'risks' | 'opportunities'>('all');

  // Mock data - in production, this would come from your analytics service
  const insights: PredictiveInsight[] = [
    {
      id: '1',
      type: 'prediction',
      severity: 'high',
      title: 'Compliance Score Improvement Opportunity',
      description: 'Based on current assessment patterns, you could achieve 15% higher compliance scores by focusing on data handling procedures.',
      impact: 'Could improve overall compliance rating from B+ to A-',
      confidence: 87,
      timeframe: '3-6 months',
      actionItems: [
        'Review and update data classification procedures',
        'Implement additional staff training on data handling',
        'Establish regular compliance audits for data processes'
      ],
      metadata: {
        dataPoints: 156,
        lastUpdated: new Date(),
        source: ['assessments', 'user_behavior', 'compliance_trends']
      }
    },
    {
      id: '2',
      type: 'trend',
      severity: 'medium',
      title: 'Assessment Completion Rate Declining',
      description: 'Assessment completion rates have dropped 12% over the last 60 days, primarily in the environmental management section.',
      impact: 'May affect overall compliance visibility and reporting accuracy',
      confidence: 92,
      timeframe: 'Current trend',
      actionItems: [
        'Simplify environmental management questions',
        'Provide additional guidance for complex sections',
        'Implement progress saving and reminders'
      ],
      metadata: {
        dataPoints: 89,
        lastUpdated: new Date(),
        source: ['user_analytics', 'assessment_data']
      }
    },
    {
      id: '3',
      type: 'anomaly',
      severity: 'low',
      title: 'Unusual Peak in Security Assessment Activity',
      description: 'Security-related assessments have increased 45% this month, possibly indicating industry-wide security focus.',
      impact: 'Positive indicator of proactive security management',
      confidence: 78,
      timeframe: 'Last 30 days',
      actionItems: [
        'Leverage this momentum for comprehensive security reviews',
        'Consider offering advanced security assessment templates',
        'Monitor for emerging security compliance requirements'
      ],
      metadata: {
        dataPoints: 67,
        lastUpdated: new Date(),
        source: ['assessment_trends', 'industry_data']
      }
    },
    {
      id: '4',
      type: 'recommendation',
      severity: 'medium',
      title: 'Optimal Assessment Scheduling Identified',
      description: 'Data shows 23% higher completion rates when assessments are started on Tuesdays or Wednesdays between 9-11 AM.',
      impact: 'Could improve overall assessment completion by 20-25%',
      confidence: 84,
      timeframe: 'Immediate implementation',
      actionItems: [
        'Schedule assessment reminders for optimal time windows',
        'Adjust notification timing for better engagement',
        'Consider assessment difficulty based on optimal completion times'
      ],
      metadata: {
        dataPoints: 234,
        lastUpdated: new Date(),
        source: ['user_behavior', 'completion_analytics']
      }
    }
  ];

  const complianceForecasts: ComplianceForecast[] = [
    {
      currentScore: 78,
      predictedScore: 85,
      trend: 'improving',
      timeToTarget: 4,
      riskFactors: ['Staff turnover in compliance team', 'New regulation implementation']
    },
    {
      currentScore: 65,
      predictedScore: 62,
      trend: 'declining',
      timeToTarget: 8,
      riskFactors: ['Outdated procedures', 'Limited training budget', 'Technology gaps']
    }
  ];

  const trendData: TrendData[] = [
    { period: 'Jan', value: 72, predicted: 74, confidence: 89 },
    { period: 'Feb', value: 75, predicted: 76, confidence: 87 },
    { period: 'Mar', value: 78, predicted: 79, confidence: 85 },
    { period: 'Apr', value: 76, predicted: 78, confidence: 82 },
    { period: 'May', value: 79, predicted: 81, confidence: 88 },
    { period: 'Jun', value: 82, predicted: 84, confidence: 90 }
  ];

  const filteredInsights = insights.filter(insight => {
    if (selectedInsightType === 'all') return true;
    if (selectedInsightType === 'trends') return insight.type === 'trend';
    if (selectedInsightType === 'risks') return insight.severity === 'high' || insight.severity === 'critical';
    if (selectedInsightType === 'opportunities') return insight.type === 'prediction' || insight.type === 'recommendation';
    return true;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'high': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'low': return 'text-blue-600 bg-blue-50 border-blue-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
      case 'high': return <AlertTriangle className="h-5 w-5" />;
      case 'medium': return <Clock className="h-5 w-5" />;
      case 'low': return <CheckCircle className="h-5 w-5" />;
      default: return <BarChart3 className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Target className="h-6 w-6 text-primary" />
            Predictive Insights
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered predictions and recommendations for your compliance program
          </p>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as '30d' | '90d' | '1y')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="30d">Last 30 Days</option>
            <option value="90d">Last 90 Days</option>
            <option value="1y">Last Year</option>
          </select>

          <select
            value={selectedInsightType}
            onChange={(e) => setSelectedInsightType(e.target.value as 'all' | 'trends' | 'risks' | 'opportunities')}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Insights</option>
            <option value="trends">Trends</option>
            <option value="risks">Risks</option>
            <option value="opportunities">Opportunities</option>
          </select>
        </div>
      </div>

      <Tabs defaultValue="insights" className="space-y-6">
        <TabsList>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="forecasts">Compliance Forecasts</TabsTrigger>
          <TabsTrigger value="trends">Trend Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-6">
          {/* Insights Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Critical Issues</p>
                    <p className="text-2xl font-bold text-red-600">
                      {insights.filter(i => i.severity === 'critical').length}
                    </p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Opportunities</p>
                    <p className="text-2xl font-bold text-green-600">
                      {insights.filter(i => i.type === 'recommendation').length}
                    </p>
                  </div>
                  <Target className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Active Trends</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {insights.filter(i => i.type === 'trend').length}
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Avg Confidence</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {Math.round(insights.reduce((sum, i) => sum + i.confidence, 0) / insights.length)}%
                    </p>
                  </div>
                  <Award className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Insights List */}
          <div className="space-y-4">
            {filteredInsights.map((insight) => (
              <Card key={insight.id} className={`border-l-4 ${getSeverityColor(insight.severity)}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {getSeverityIcon(insight.severity)}
                      <div>
                        <CardTitle className="text-lg">{insight.title}</CardTitle>
                        <CardDescription className="mt-1">
                          {insight.description}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant="outline" className={getSeverityColor(insight.severity)}>
                        {insight.severity.toUpperCase()}
                      </Badge>
                      <div className="text-sm text-muted-foreground">
                        {insight.confidence}% confidence
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Expected Impact</h4>
                    <p className="text-sm">{insight.impact}</p>
                  </div>

                  <div>
                    <h4 className="font-medium text-sm text-muted-foreground mb-2">Recommended Actions</h4>
                    <ul className="space-y-1">
                      {insight.actionItems.map((action, index) => (
                        <li key={index} className="text-sm flex items-start gap-2">
                          <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="text-xs text-muted-foreground">
                      Timeframe: {insight.timeframe}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Based on {insight.metadata.dataPoints} data points
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {complianceForecasts.map((forecast, index) => (
              <Card key={index}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Compliance Score Forecast
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">Current Score</p>
                      <p className="text-3xl font-bold">{forecast.currentScore}%</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">Predicted Score</p>
                      <p className={`text-3xl font-bold flex items-center gap-2 ${
                        forecast.trend === 'improving' ? 'text-green-600' : 
                        forecast.trend === 'declining' ? 'text-red-600' : 'text-gray-600'
                      }`}>
                        {forecast.predictedScore}%
                        {forecast.trend === 'improving' ? <TrendingUp className="h-6 w-6" /> :
                         forecast.trend === 'declining' ? <TrendingDown className="h-6 w-6" /> : null}
                      </p>
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-muted-foreground">Progress to Target</span>
                      <span className="text-sm font-medium">{forecast.timeToTarget} months</span>
                    </div>
                    <Progress value={(forecast.predictedScore / 100) * 100} className="h-2" />
                  </div>

                  {forecast.riskFactors.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm text-muted-foreground mb-2">Risk Factors</h4>
                      <ul className="space-y-1">
                        {forecast.riskFactors.map((risk, riskIndex) => (
                          <li key={riskIndex} className="text-sm flex items-start gap-2">
                            <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                            {risk}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Compliance Score Trends</CardTitle>
              <CardDescription>
                Historical performance with predictive modeling
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-end justify-between gap-2 p-4 bg-gray-50 rounded-lg">
                {trendData.map((data, index) => (
                  <div key={index} className="flex flex-col items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="bg-blue-500 rounded-t-sm w-8"
                        style={{
                          height: `${(data.value / 100) * 150}px`,
                          minHeight: '20px'
                        }}
                      />
                      <div
                        className="bg-blue-300 border-2 border-dashed border-blue-500 rounded-t-sm w-8"
                        style={{
                          height: `${(data.predicted / 100) * 150}px`,
                          minHeight: '20px'
                        }}
                      />
                    </div>
                    <div className="text-xs text-center">
                      <div className="font-medium">{data.period}</div>
                      <div className="text-muted-foreground">{data.confidence}%</div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex justify-center gap-6 mt-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-500 rounded" />
                  <span>Actual</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 bg-blue-300 border-2 border-dashed border-blue-500 rounded" />
                  <span>Predicted</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}