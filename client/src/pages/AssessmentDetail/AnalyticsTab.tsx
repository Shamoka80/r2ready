import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Target,
  BarChart3,
  PieChart,
  Activity,
  RefreshCw,
  Download,
  Calendar
} from "lucide-react";

interface AnalyticsData {
  overallScore: number;
  complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE';
  readinessLevel: 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY';
  estimatedAuditSuccess: number;
  categoryScores: CategoryScore[];
  criticalIssues: string[];
  recommendations: string[];
  trends: TrendData[];
  timeline: TimelineData[];
  gapAnalysis: GapAnalysisData[];
  lastCalculated: string;
}

interface CategoryScore {
  category: string;
  categoryName: string;
  score: number;
  maxScore: number;
  percentage: number;
  weight: number;
  required: boolean;
  questionsAnswered: number;
  totalQuestions: number;
  criticalGaps: string[];
}

interface TrendData {
  date: string;
  overallScore: number;
  completedQuestions: number;
  complianceStatus: string;
}

interface TimelineData {
  milestone: string;
  targetDate: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'OVERDUE';
  progress: number;
  description: string;
}

interface GapAnalysisData {
  category: string;
  currentScore: number;
  targetScore: number;
  gap: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  estimatedEffort: string;
  recommendations: string[];
}

export default function AnalyticsTab() {
  const [match, params] = useRoute("/assessments/:id");
  const assessmentId = params?.id;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalytics = async () => {
    if (!assessmentId) return;

    try {
      setRefreshing(true);
      const response = await fetch(`/api/assessments/${assessmentId}/analytics`);
      if (response.ok) {
        const data = await response.json();
        setAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [assessmentId]);

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-jade text-white';
      case 'PARTIAL': return 'bg-sunglow text-black';
      case 'NON_COMPLIANT': return 'bg-pumpkin text-white';
      default: return 'bg-dimgrey text-white';
    }
  };

  const getReadinessLevelColor = (level: string) => {
    switch (level) {
      case 'AUDIT_READY': return 'bg-jade text-white';
      case 'NEEDS_IMPROVEMENT': return 'bg-sunglow text-black';
      case 'MAJOR_GAPS': return 'bg-pumpkin text-white';
      default: return 'bg-dimgrey text-white';
    }
  };

  // Default analytics data structure
  const defaultAnalytics: AnalyticsData = {
    overallScore: 0,
    complianceStatus: 'INCOMPLETE',
    readinessLevel: 'NOT_READY',
    estimatedAuditSuccess: 0,
    categoryScores: [],
    criticalIssues: [
      'Missing EPA documentation for waste handling',
      'Security controls need improvement',
      'Data sanitization procedures incomplete'
    ],
    recommendations: [
      'Complete EPA documentation requirements immediately',
      'Implement additional facility security measures',
      'Develop comprehensive data destruction protocols',
      'Schedule internal audit before certification',
      'Focus on required questions first'
    ],
    trends: [
      { date: '2024-01-15', overallScore: 45, completedQuestions: 12, complianceStatus: 'INCOMPLETE' },
      { date: '2024-01-20', overallScore: 62, completedQuestions: 18, complianceStatus: 'PARTIAL' },
      { date: '2024-01-25', overallScore: 78, completedQuestions: 24, complianceStatus: 'PARTIAL' }
    ],
    timeline: [
      {
        milestone: 'Complete Required Questions',
        targetDate: '2024-02-01',
        status: 'IN_PROGRESS',
        progress: 75,
        description: 'Answer all mandatory compliance questions'
      },
      {
        milestone: 'Address Critical Gaps',
        targetDate: '2024-02-15',
        status: 'PENDING',
        progress: 25,
        description: 'Resolve identified compliance issues'
      },
      {
        milestone: 'Internal Audit',
        targetDate: '2024-03-01',
        status: 'PENDING',
        progress: 0,
        description: 'Conduct internal assessment review'
      },
      {
        milestone: 'Certification Submission',
        targetDate: '2024-03-15',
        status: 'PENDING',
        progress: 0,
        description: 'Submit for R2v3 certification'
      }
    ],
    gapAnalysis: [
      {
        category: 'Legal Compliance',
        currentScore: 85,
        targetScore: 95,
        gap: 10,
        priority: 'HIGH',
        estimatedEffort: '2-3 weeks',
        recommendations: ['Complete EPA documentation', 'Update permit status']
      },
      {
        category: 'Data Security',
        currentScore: 70,
        targetScore: 90,
        gap: 20,
        priority: 'HIGH',
        estimatedEffort: '3-4 weeks',
        recommendations: ['Implement encryption protocols', 'Update access controls']
      },
      {
        category: 'Facility Operations',
        currentScore: 75,
        targetScore: 85,
        gap: 10,
        priority: 'MEDIUM',
        estimatedEffort: '1-2 weeks',
        recommendations: ['Improve security measures', 'Update procedures']
      }
    ],
    lastCalculated: new Date().toISOString()
  };

  const displayAnalytics = analytics || defaultAnalytics;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-jade mx-auto mb-4" />
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Assessment Analytics</h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(displayAnalytics.lastCalculated).toLocaleString()}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            disabled={refreshing}
            className="text-jade border-jade hover:bg-jade/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-jade border-jade hover:bg-jade/10"
          >
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overall Score</p>
                <p className="text-2xl font-bold text-foreground">{displayAnalytics.overallScore}%</p>
              </div>
              <div className="w-12 h-12 bg-jade/10 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-jade" />
              </div>
            </div>
            <Progress value={displayAnalytics.overallScore} className="mt-2" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Compliance Status</p>
                <Badge className={`mt-1 ${getComplianceStatusColor(displayAnalytics.complianceStatus)}`}>
                  {displayAnalytics.complianceStatus.replace('_', ' ')}
                </Badge>
              </div>
              <div className="w-12 h-12 bg-sunglow/10 rounded-lg flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-sunglow" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Readiness Level</p>
                <Badge className={`mt-1 ${getReadinessLevelColor(displayAnalytics.readinessLevel)}`}>
                  {displayAnalytics.readinessLevel.replace('_', ' ')}
                </Badge>
              </div>
              <div className="w-12 h-12 bg-pumpkin/10 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-pumpkin" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Audit Success</p>
                <p className="text-2xl font-bold text-foreground">{displayAnalytics.estimatedAuditSuccess}%</p>
              </div>
              <div className="w-12 h-12 bg-icterine/10 rounded-lg flex items-center justify-center">
                <Activity className="w-6 h-6 text-icterine" />
              </div>
            </div>
            <Progress value={displayAnalytics.estimatedAuditSuccess} className="mt-2" />
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Category Performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2 text-jade" />
              Category Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayAnalytics.categoryScores.map((category, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-foreground">
                        {category.categoryName}
                      </span>
                      {category.required && (
                        <Badge variant="outline" className="text-xs">Required</Badge>
                      )}
                    </div>
                    <span className="text-sm font-bold text-foreground">
                      {category.percentage}%
                    </span>
                  </div>
                  <Progress value={category.percentage} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{category.questionsAnswered}/{category.totalQuestions} questions</span>
                    <span>Weight: {category.weight}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Gap Analysis */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-pumpkin" />
              Gap Analysis
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayAnalytics.gapAnalysis.map((gap, index) => (
                <div key={index} className="border border-border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-foreground">{gap.category}</span>
                    <Badge 
                      className={`text-xs ${
                        gap.priority === 'HIGH' ? 'bg-pumpkin text-white' :
                        gap.priority === 'MEDIUM' ? 'bg-sunglow text-black' :
                        'bg-jade text-white'
                      }`}
                    >
                      {gap.priority}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-2">
                    <div>
                      <span className="text-muted-foreground">Current:</span>
                      <div className="font-medium">{gap.currentScore}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target:</span>
                      <div className="font-medium">{gap.targetScore}%</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gap:</span>
                      <div className="font-medium text-pumpkin">{gap.gap}%</div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Estimated effort: {gap.estimatedEffort}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Timeline and Critical Issues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Calendar className="w-5 h-5 mr-2 text-icterine" />
              Certification Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {displayAnalytics.timeline.map((milestone, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`w-3 h-3 rounded-full mt-2 flex-shrink-0 ${
                    milestone.status === 'COMPLETED' ? 'bg-jade' :
                    milestone.status === 'IN_PROGRESS' ? 'bg-sunglow' :
                    milestone.status === 'OVERDUE' ? 'bg-pumpkin' :
                    'bg-dimgrey'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-foreground">
                        {milestone.milestone}
                      </p>
                      <span className="text-xs text-muted-foreground">
                        {new Date(milestone.targetDate).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{milestone.description}</p>
                    <Progress value={milestone.progress} className="h-1" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Critical Issues & Recommendations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-pumpkin" />
              Critical Issues & Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Critical Issues</h4>
                <div className="space-y-2">
                  {displayAnalytics.criticalIssues.map((issue, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-pumpkin mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{issue}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Top Recommendations</h4>
                <div className="space-y-2">
                  {displayAnalytics.recommendations.slice(0, 5).map((rec, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-jade mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}