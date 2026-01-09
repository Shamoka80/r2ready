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

interface PredictiveInsightsProps {
  assessmentId?: string;
  insights?: {
    anomalies: Array<{
      type: 'document' | 'activity' | 'compliance' | 'training';
      severity: 'low' | 'medium' | 'high' | 'critical';
      description: string;
      recommendation: string;
      confidence: number;
    }>;
    riskAssessment: {
      overallRisk: number;
      complianceGaps: Array<{
        area: string;
        risk: number;
        impact: string;
        mitigation: string;
      }>;
      predictions: Array<{
        metric: string;
        currentValue: number;
        predictedValue: number;
        timeframe: string;
        confidence: number;
      }>;
    };
    resourceForecasting: {
      staffingNeeds: {
        current: number;
        predicted: number;
        roles: Array<{ role: string; count: number; priority: string }>;
      };
      trainingRequirements: Array<{
        module: string;
        urgency: string;
        estimatedHours: number;
        completion: number;
      }>;
    };
    trendAnalysis: {
      documentTrends: Array<{
        category: string;
        trend: 'increasing' | 'decreasing' | 'stable';
        changePercentage: number;
        significance: string;
      }>;
      complianceTrends: Array<{
        area: string;
        direction: 'improving' | 'declining' | 'stable';
        velocity: number;
        forecast: string;
      }>;
    };
  };
  trends?: Array<{
    date: string;
    score: number;
    assessments: number;
    documents: number;
    risk: number;
    compliance: number;
  }>;
}

export default function PredictiveInsights({ insights: apiInsights, trends: historicalTrends }: PredictiveInsightsProps = {}) {
  const [selectedTimeframe, setSelectedTimeframe] = useState<'30d' | '90d' | '1y'>('90d');
  const [selectedInsightType, setSelectedInsightType] = useState<'all' | 'trends' | 'risks' | 'opportunities'>('all');

  // Convert API insights to component format
  const insights: PredictiveInsight[] = apiInsights ? [
    // Convert anomalies to insights
    ...(apiInsights.anomalies || []).map((anomaly, index) => ({
      id: `anomaly-${index}`,
      type: 'anomaly' as const,
      severity: anomaly.severity,
      title: `${anomaly.type.charAt(0).toUpperCase() + anomaly.type.slice(1)} Anomaly Detected`,
      description: anomaly.description,
      impact: anomaly.recommendation,
      confidence: anomaly.confidence,
      timeframe: 'Recent activity',
      actionItems: [anomaly.recommendation],
      metadata: {
        dataPoints: 0,
        lastUpdated: new Date(),
        source: ['system_analytics']
      }
    })),
    // Convert predictions to insights
    ...(apiInsights.riskAssessment?.predictions || []).map((pred, index) => ({
      id: `prediction-${index}`,
      type: 'prediction' as const,
      severity: pred.confidence > 80 ? 'high' as const : pred.confidence > 60 ? 'medium' as const : 'low' as const,
      title: `${pred.metric} Forecast`,
      description: `${pred.metric} is predicted to ${pred.predictedValue > pred.currentValue ? 'improve' : 'decline'} from ${pred.currentValue} to ${pred.predictedValue} in ${pred.timeframe}`,
      impact: `Expected change of ${Math.abs(pred.predictedValue - pred.currentValue)}`,
      confidence: pred.confidence,
      timeframe: pred.timeframe,
      actionItems: ['Monitor trend closely', 'Take proactive measures if needed'],
      metadata: {
        dataPoints: 0,
        lastUpdated: new Date(),
        source: ['predictive_analytics']
      }
    })),
    // Convert compliance trends to insights
    ...(apiInsights.trendAnalysis?.complianceTrends || []).map((trend, index) => ({
      id: `trend-${index}`,
      type: 'trend' as const,
      severity: trend.direction === 'declining' ? 'medium' as const : 'low' as const,
      title: `${trend.area} Compliance Trend`,
      description: `${trend.area} compliance is ${trend.direction} with a velocity of ${trend.velocity}`,
      impact: trend.forecast,
      confidence: Math.abs(trend.velocity) > 10 ? 85 : 70,
      timeframe: 'Current trend',
      actionItems: ['Continue monitoring', 'Implement improvements if declining'],
      metadata: {
        dataPoints: 0,
        lastUpdated: new Date(),
        source: ['trend_analysis']
      }
    })),
    // Convert compliance gaps to insights
    ...(apiInsights.riskAssessment?.complianceGaps || []).map((gap, index) => ({
      id: `gap-${index}`,
      type: 'recommendation' as const,
      severity: gap.risk > 70 ? 'high' as const : gap.risk > 40 ? 'medium' as const : 'low' as const,
      title: `Compliance Gap: ${gap.area}`,
      description: `${gap.area} has a risk level of ${gap.risk}% with ${gap.impact} impact`,
      impact: gap.impact,
      confidence: 80,
      timeframe: 'Address within 30 days',
      actionItems: [gap.mitigation],
      metadata: {
        dataPoints: 0,
        lastUpdated: new Date(),
        source: ['risk_assessment']
      }
    }))
  ] : [];

  // Generate additional insights from historical trends if no other insights exist
  const baseInsightsCount = insights.length;
  const additionalInsights: PredictiveInsight[] = (baseInsightsCount === 0 && historicalTrends && historicalTrends.length > 0) ? (() => {
    const validTrends = historicalTrends.filter(t => typeof t.score === 'number' && t.score > 0);
    if (validTrends.length > 0) {
      return [{
        id: 'trend-based-insight-1',
        type: 'recommendation' as const,
        severity: 'low' as const,
        title: 'Start Tracking Compliance Metrics',
        description: `You have ${validTrends.length} month${validTrends.length > 1 ? 's' : ''} of compliance data. Continue completing assessments to generate more detailed insights.`,
        impact: 'Better visibility into compliance trends and risk areas',
        confidence: 75,
        timeframe: 'Ongoing',
        actionItems: [
          'Complete regular compliance assessments',
          'Upload evidence documents for completed assessments',
          'Review and address any identified compliance gaps'
        ],
        metadata: {
          dataPoints: validTrends.length,
          lastUpdated: new Date(),
          source: ['historical_data']
        }
      }];
    }
    return [];
  })() : [];
  
  // Combine base insights with additional insights
  let allInsights = [...insights, ...additionalInsights];
  
  // If still no insights, provide a default onboarding insight
  if (allInsights.length === 0) {
    allInsights = [{
      id: 'default-onboarding-insight',
      type: 'recommendation' as const,
      severity: 'low' as const,
      title: 'Get Started with Compliance Analytics',
      description: 'Begin tracking your compliance metrics by completing assessments. As you collect data, predictive insights will automatically appear here.',
      impact: 'Enable data-driven compliance decision making',
      confidence: 90,
      timeframe: 'Get started today',
      actionItems: [
        'Create and complete your first compliance assessment',
        'Upload supporting evidence documents',
        'Review assessment results and identify areas for improvement',
        'Set up regular assessment schedules'
      ],
      metadata: {
        dataPoints: 0,
        lastUpdated: new Date(),
        source: ['onboarding']
      }
    }];
  }

  // Convert historical trends to chart data
  const trendData: TrendData[] = historicalTrends && Array.isArray(historicalTrends) && historicalTrends.length > 0
    ? historicalTrends.map((trend, index) => {
        try {
          const date = new Date(trend.date);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          // Ensure we have valid numbers
          const score = typeof trend.score === 'number' ? trend.score : 0;
          const compliance = typeof trend.compliance === 'number' ? trend.compliance : (score > 0 ? score + 5 : 0);
          
          return {
            period: monthNames[date.getMonth()] || `Month ${index + 1}`,
            value: Math.max(0, Math.min(100, score)), // Clamp between 0-100
            predicted: Math.max(0, Math.min(100, compliance)), // Clamp between 0-100
            confidence: score > 0 ? 85 : 50 // Calculate confidence based on data availability
          };
        } catch (error) {
          console.error('Error processing trend data:', error, trend);
          return {
            period: `Month ${index + 1}`,
            value: 0,
            predicted: 0,
            confidence: 0
          };
        }
      })
    : [];

  // Generate forecasts from real data
  const complianceForecasts: ComplianceForecast[] = historicalTrends && Array.isArray(historicalTrends) && historicalTrends.length >= 2
    ? (() => {
        const recentTrends = historicalTrends.slice(-2);
        const current = recentTrends[recentTrends.length - 1];
        const previous = recentTrends[recentTrends.length - 2];
        
        if (!current || !previous) return [];
        
        const currentScore = typeof current.score === 'number' ? current.score : 0;
        const previousScore = typeof previous.score === 'number' ? previous.score : 0;
        const trend = currentScore > previousScore ? 'improving' : currentScore < previousScore ? 'declining' : 'stable';
        const predictedScore = trend === 'improving' 
          ? Math.min(100, currentScore + (currentScore - previousScore))
          : trend === 'declining'
          ? Math.max(0, currentScore + (currentScore - previousScore))
          : currentScore;
        
        const riskFactors: string[] = [];
        if (apiInsights?.riskAssessment && apiInsights.riskAssessment.overallRisk > 70) {
          riskFactors.push('High overall risk level');
        }
        if (apiInsights?.riskAssessment?.complianceGaps && apiInsights.riskAssessment.complianceGaps.length > 0) {
          riskFactors.push(...apiInsights.riskAssessment.complianceGaps.slice(0, 2).map(g => g.area));
        }
        if (riskFactors.length === 0) riskFactors.push('No significant risk factors identified');

        return [{
          currentScore: currentScore,
          predictedScore: Math.round(predictedScore),
          trend: trend,
          timeToTarget: trend === 'improving' ? 6 : trend === 'declining' ? 3 : 12,
          riskFactors: riskFactors
        }];
      })()
    : [];

  const filteredInsights = allInsights.filter(insight => {
    if (selectedInsightType === 'all') return true;
    if (selectedInsightType === 'trends') return insight.type === 'trend';
    if (selectedInsightType === 'risks') return insight.severity === 'high' || insight.severity === 'critical';
    if (selectedInsightType === 'opportunities') return insight.type === 'prediction' || insight.type === 'recommendation';
    return true;
  });

  // Show message if no data available
  // Always consider having data if we have insights (which now always includes at least the default)
  const hasData = allInsights.length > 0 || trendData.length > 0 || complianceForecasts.length > 0 || 
    (historicalTrends && Array.isArray(historicalTrends) && historicalTrends.length > 0);

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
          {!hasData ? (
            <Card>
              <CardContent className="text-center py-8">
                <Target className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground">No predictive insights available yet.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Insights will appear as more assessment and compliance data is collected.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Insights Overview */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Critical Issues</p>
                        <p className="text-2xl font-bold text-red-600">
                          {allInsights.filter(i => i.severity === 'critical').length}
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
                          {allInsights.filter(i => i.type === 'recommendation').length}
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
                          {allInsights.filter(i => i.type === 'trend').length}
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
                          {allInsights.length > 0 
                            ? Math.round(allInsights.reduce((sum, i) => sum + i.confidence, 0) / allInsights.length)
                            : 0}%
                        </p>
                      </div>
                      <Award className="h-8 w-8 text-purple-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Insights List */}
              <div className="space-y-4">
                {filteredInsights.length > 0 ? filteredInsights.map((insight) => (
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
            )) : (
              <Card>
                <CardContent className="text-center py-8">
                  <p className="text-foreground">No insights match the selected filter.</p>
                </CardContent>
              </Card>
            )}
          </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="forecasts" className="space-y-6">
          {complianceForecasts.length > 0 ? (
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
          ) : (
            <Card>
              <CardContent className="text-center py-8">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-foreground">No forecast data available.</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Historical data is needed to generate compliance forecasts.
                </p>
              </CardContent>
            </Card>
          )}
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
              {trendData.length > 0 ? (
                <>
                  <div className="h-64 flex items-end justify-between gap-2 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    {trendData.map((data, index) => {
                      // Ensure minimum visible height even for 0 values
                      const actualHeight = Math.max((data.value || 0) / 100 * 150, data.value === 0 ? 8 : 10);
                      const predictedHeight = Math.max((data.predicted || 0) / 100 * 150, data.predicted === 0 ? 8 : 10);
                      
                      return (
                        <div key={index} className="flex flex-col items-center gap-2 flex-1">
                          <div className="flex flex-col items-center gap-1 w-full">
                            {/* Actual bar */}
                            <div
                              className="bg-blue-500 rounded-t-sm w-full transition-all"
                              style={{
                                height: `${actualHeight}px`,
                                minHeight: '8px'
                              }}
                              title={`Actual: ${data.value}%`}
                            />
                            {/* Predicted bar */}
                            <div
                              className="bg-blue-300 border-2 border-dashed border-blue-500 rounded-t-sm w-full transition-all"
                              style={{
                                height: `${predictedHeight}px`,
                                minHeight: '8px'
                              }}
                              title={`Predicted: ${data.predicted}%`}
                            />
                          </div>
                          <div className="text-xs text-center mt-1">
                            <div className="font-medium">{data.period}</div>
                            {data.value > 0 && (
                              <div className="text-muted-foreground text-[10px]">{data.value}%</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
                </>
              ) : (
                <div className="text-center py-8">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-foreground">No trend data available.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Complete assessments to generate historical compliance trends.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}