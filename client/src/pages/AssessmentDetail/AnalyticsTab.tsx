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
import { apiGet } from "@/api";

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

interface AnalyticsTabProps {
  assessmentId?: string;
  intakeFormId?: string;
}

export default function AnalyticsTab({ assessmentId: propAssessmentId, intakeFormId }: AnalyticsTabProps) {
  const [match, params] = useRoute("/assessments/:id");
  const routeAssessmentId = params?.id;
  const assessmentId = propAssessmentId || routeAssessmentId;
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculateTimelineFromData = (scoringData: any): TimelineData[] => {
    if (!scoringData) return [];
    
    const now = new Date();
    const getTargetDate = (daysFromNow: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() + daysFromNow);
      return date.toISOString().split('T')[0];
    };

    // Calculate required questions progress
    const requiredQuestionsProgress = scoringData.categoryScores
      ? scoringData.categoryScores
          .filter((cat: CategoryScore) => cat.required)
          .reduce((sum: number, cat: CategoryScore) => sum + (cat.questionsAnswered / cat.totalQuestions), 0) / 
          Math.max(1, scoringData.categoryScores.filter((cat: CategoryScore) => cat.required).length) * 100
      : 0;

    // Calculate critical gaps progress
    const criticalGapsCount = scoringData.criticalIssues?.length || 0;
    const criticalGapsProgress = Math.max(0, 100 - (criticalGapsCount * 25));

    return [
      {
        milestone: 'Complete Required Questions',
        targetDate: getTargetDate(7),
        status: requiredQuestionsProgress >= 75 ? 'IN_PROGRESS' : requiredQuestionsProgress > 0 ? 'IN_PROGRESS' : 'PENDING',
        progress: Math.min(100, Math.round(requiredQuestionsProgress)),
        description: 'Answer all mandatory compliance questions'
      },
      {
        milestone: 'Address Critical Gaps',
        targetDate: getTargetDate(21),
        status: criticalGapsCount < 3 && criticalGapsCount > 0 ? 'IN_PROGRESS' : criticalGapsCount === 0 ? 'COMPLETED' : 'PENDING',
        progress: Math.max(0, Math.round(criticalGapsProgress)),
        description: 'Resolve identified compliance issues'
      },
      {
        milestone: 'Internal Audit',
        targetDate: getTargetDate(35),
        status: scoringData.readinessLevel === 'AUDIT_READY' ? 'IN_PROGRESS' : 'PENDING',
        progress: scoringData.readinessLevel === 'AUDIT_READY' ? 25 : 0,
        description: 'Conduct internal assessment review'
      },
      {
        milestone: 'Certification Submission',
        targetDate: getTargetDate(49),
        status: scoringData.complianceStatus === 'COMPLIANT' ? 'IN_PROGRESS' : 'PENDING',
        progress: scoringData.complianceStatus === 'COMPLIANT' ? 10 : 0,
        description: 'Submit for R2v3 certification'
      }
    ];
  };

  const calculateGapAnalysisFromData = (categoryScores: CategoryScore[]): GapAnalysisData[] => {
    if (!categoryScores || categoryScores.length === 0) return [];

    return categoryScores
      .map((category) => {
        const currentScore = category.percentage;
        const targetScore = category.required ? 95 : 85;
        const gap = Math.max(0, targetScore - currentScore);

        if (gap === 0) return null;

        let priority: 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
        if (category.required && gap > 15) priority = 'HIGH';
        else if (gap > 20) priority = 'HIGH';
        else if (gap > 10) priority = 'MEDIUM';

        const estimatedEffort = gap > 20 ? '3-4 weeks' : gap > 10 ? '2-3 weeks' : '1-2 weeks';

        const recommendations: string[] = [];
        if (category.questionsAnswered < category.totalQuestions) {
          recommendations.push(`Complete ${category.totalQuestions - category.questionsAnswered} unanswered questions`);
        }
        if (category.criticalGaps && category.criticalGaps.length > 0) {
          recommendations.push(`Address ${category.criticalGaps.length} critical gap(s) in this category`);
        }
        if (category.percentage < targetScore) {
          recommendations.push(`Improve compliance score from ${category.percentage}% to ${targetScore}%`);
        }

        return {
          category: category.categoryName,
          currentScore,
          targetScore,
          gap,
          priority,
          estimatedEffort,
          recommendations: recommendations.length > 0 ? recommendations : [`Focus on improving ${category.categoryName} compliance`]
        };
      })
      .filter((gap): gap is GapAnalysisData => gap !== null)
      .sort((a, b) => {
        // Sort by priority (HIGH first) then by gap size
        const priorityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        return b.gap - a.gap;
      });
  };

  const fetchAnalytics = async () => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      setError(null);
      
      // Build endpoint with query parameter if needed
      let endpoint = `/assessments/${assessmentId}/analytics`;
      if (intakeFormId) {
        endpoint += `?intakeFormId=${intakeFormId}`;
      }
      
      // Use apiGet which automatically includes Authorization header
      const data = await apiGet<any>(endpoint);
      
      // Calculate timeline and gap analysis from real data
      const timeline = calculateTimelineFromData(data);
      const gapAnalysis = calculateGapAnalysisFromData(data.categoryScores || []);
      
      // Build complete analytics object from API data
      const analyticsData: AnalyticsData = {
        overallScore: data.overallScore || 0,
        complianceStatus: data.complianceStatus || 'INCOMPLETE',
        readinessLevel: data.readinessLevel || 'NOT_READY',
        estimatedAuditSuccess: data.estimatedAuditSuccess || 0,
        categoryScores: data.categoryScores || [],
        criticalIssues: data.criticalIssues || [],
        recommendations: data.recommendations || [],
        trends: [], // Trends would require historical data - leave empty for now
        timeline: timeline,
        gapAnalysis: gapAnalysis,
        lastCalculated: data.lastCalculated || new Date().toISOString()
      };
      
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch analytics';
      setError(errorMessage);
      
      // Check if it's an authentication error
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        setError('Authentication failed. Please refresh the page and try again.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [assessmentId, intakeFormId]);

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

  // Create empty analytics structure when no data is available
  const emptyAnalytics: AnalyticsData = {
    overallScore: 0,
    complianceStatus: 'INCOMPLETE',
    readinessLevel: 'NOT_READY',
    estimatedAuditSuccess: 0,
    categoryScores: [],
    criticalIssues: [],
    recommendations: [],
    trends: [],
    timeline: [],
    gapAnalysis: [],
    lastCalculated: new Date().toISOString()
  };

  const displayAnalytics = analytics || emptyAnalytics;

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

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <AlertTriangle className="w-8 h-8 text-pumpkin mx-auto mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAnalytics}
            className="mt-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
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
              {displayAnalytics.categoryScores.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No category data available</p>
              ) : (
                displayAnalytics.categoryScores.map((category, index) => (
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
                ))
              )}
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
              {displayAnalytics.gapAnalysis.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No gaps identified - all categories meet target scores</p>
              ) : (
                displayAnalytics.gapAnalysis.map((gap, index) => (
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
                ))
              )}
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
              {displayAnalytics.timeline.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No timeline data available</p>
              ) : (
                displayAnalytics.timeline.map((milestone, index) => (
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
                ))
              )}
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
                  {displayAnalytics.criticalIssues.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No critical issues identified</p>
                  ) : (
                    displayAnalytics.criticalIssues.map((issue, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <AlertTriangle className="w-4 h-4 text-pumpkin mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{issue}</span>
                    </div>
                    ))
                  )}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-foreground mb-2">Top Recommendations</h4>
                <div className="space-y-2">
                  {displayAnalytics.recommendations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No recommendations available</p>
                  ) : (
                    displayAnalytics.recommendations.slice(0, 5).map((rec, index) => (
                    <div key={index} className="flex items-start space-x-2">
                      <CheckCircle className="w-4 h-4 text-jade mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-foreground">{rec}</span>
                    </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}