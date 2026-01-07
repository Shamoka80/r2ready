import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  AlertTriangle, 
  CheckCircle, 
  Lightbulb,
  RefreshCw,
  Download,
  TrendingUp,
  Target,
  FileText,
  Clock,
  AlertCircle
} from "lucide-react";
import { apiGet } from "@/api";

interface FindingsData {
  summary: string;
  keyFindings: Finding[];
  recommendations: Recommendation[];
  gapAnalysis: GapItem[];
  complianceStatus: 'COMPLIANT' | 'NEEDS_IMPROVEMENT' | 'NON_COMPLIANT' | 'INCOMPLETE';
  businessImpact: string;
  nextSteps: string[];
  lastCalculated: string;
}

interface Finding {
  id: string;
  title: string;
  description: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  impact: string;
  recommendation?: string;
}

interface Recommendation {
  id: string;
  title: string;
  description: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  category: string;
  estimatedEffort: string;
  impact: string;
}

interface GapItem {
  questionId: string;
  questionText: string;
  category: string;
  currentScore: number;
  targetScore: number;
  gapSeverity: 'CRITICAL' | 'MAJOR' | 'MINOR';
  impact: string;
  recommendation: string;
}

interface FindingsTabProps {
  assessmentId?: string;
  intakeFormId?: string;
}

export default function FindingsTab({ assessmentId: propAssessmentId, intakeFormId }: FindingsTabProps) {
  const [match, params] = useRoute("/assessments/:id");
  const routeAssessmentId = params?.id;
  const assessmentId = propAssessmentId || routeAssessmentId;
  const [findings, setFindings] = useState<FindingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFindings = async () => {
    if (!assessmentId) {
      setLoading(false);
      return;
    }

    try {
      setRefreshing(true);
      setError(null);
      
      // Build endpoint with query parameter if needed
      let endpoint = `/assessments/${assessmentId}/findings`;
      if (intakeFormId) {
        endpoint += `?intakeFormId=${intakeFormId}`;
      }
      
      // Use apiGet which automatically includes Authorization header
      const data = await apiGet<any>(endpoint);
      
      // Transform the API response to match our interface
      const findingsData: FindingsData = {
        summary: data.summary || 'Assessment findings analysis based on current compliance status and gaps.',
        keyFindings: data.keyFindings || [],
        recommendations: data.recommendations || [],
        gapAnalysis: data.gapAnalysis || [],
        complianceStatus: data.complianceStatus || 'INCOMPLETE',
        businessImpact: data.businessImpact || 'Assessment in progress. Business impact will be calculated once more data is available.',
        nextSteps: data.nextSteps || [],
        lastCalculated: data.lastCalculated || new Date().toISOString()
      };
      
      setFindings(findingsData);
    } catch (error) {
      console.error('Failed to fetch findings:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch findings';
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
    fetchFindings();
  }, [assessmentId, intakeFormId]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'bg-red-600 text-white';
      case 'HIGH': return 'bg-pumpkin text-white';
      case 'MEDIUM': return 'bg-sunglow text-black';
      case 'LOW': return 'bg-jade text-white';
      default: return 'bg-dimgrey text-white';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'HIGH': return 'bg-pumpkin text-white';
      case 'MEDIUM': return 'bg-sunglow text-black';
      case 'LOW': return 'bg-jade text-white';
      default: return 'bg-dimgrey text-white';
    }
  };

  const getComplianceStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLIANT': return 'bg-jade text-white';
      case 'NEEDS_IMPROVEMENT': return 'bg-sunglow text-black';
      case 'NON_COMPLIANT': return 'bg-pumpkin text-white';
      default: return 'bg-dimgrey text-white';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-jade mx-auto mb-4" />
          <p className="text-muted-foreground">Loading findings...</p>
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
            onClick={fetchFindings}
            className="mt-4"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (!findings) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No findings data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Assessment Findings</h3>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date(findings.lastCalculated).toLocaleString()}
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchFindings}
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

      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <FileText className="w-5 h-5 mr-2 text-jade" />
            Executive Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">Compliance Status</span>
              <Badge className={getComplianceStatusColor(findings.complianceStatus)}>
                {findings.complianceStatus.replace('_', ' ')}
              </Badge>
            </div>
            <p className="text-sm text-foreground leading-relaxed">{findings.summary}</p>
            {findings.businessImpact && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <h4 className="text-sm font-semibold text-foreground mb-2">Business Impact</h4>
                <p className="text-sm text-muted-foreground">{findings.businessImpact}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Key Findings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2 text-pumpkin" />
            Key Findings
            {findings.keyFindings.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {findings.keyFindings.length}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {findings.keyFindings.length === 0 ? (
            <div className="text-center py-8">
              <CheckCircle className="w-12 h-12 text-jade mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">No critical findings identified</p>
              <p className="text-xs text-muted-foreground mt-2">Continue completing the assessment to generate findings</p>
            </div>
          ) : (
            <div className="space-y-4">
              {findings.keyFindings.map((finding, index) => (
                <div key={finding.id || index} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className={`w-5 h-5 ${
                        finding.severity === 'CRITICAL' ? 'text-red-600' :
                        finding.severity === 'HIGH' ? 'text-pumpkin' :
                        finding.severity === 'MEDIUM' ? 'text-sunglow' :
                        'text-jade'
                      }`} />
                      <h4 className="font-semibold text-foreground">{finding.title || `Finding ${index + 1}`}</h4>
                    </div>
                    <Badge className={getSeverityColor(finding.severity)}>
                      {finding.severity}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{finding.description}</p>
                  {finding.impact && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <span className="font-medium text-foreground">Impact: </span>
                      <span className="text-muted-foreground">{finding.impact}</span>
                    </div>
                  )}
                  {finding.recommendation && (
                    <div className="mt-2 flex items-start space-x-2">
                      <Lightbulb className="w-4 h-4 text-jade mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Recommendation: </span>
                        {finding.recommendation}
                      </p>
                    </div>
                  )}
                  {finding.category && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {finding.category}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recommendations */}
      {findings.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Target className="w-5 h-5 mr-2 text-jade" />
              Recommendations
              <Badge variant="secondary" className="ml-2">
                {findings.recommendations.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {findings.recommendations.map((rec, index) => (
                <div key={rec.id || index} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-foreground">{rec.title || `Recommendation ${index + 1}`}</h4>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority} Priority
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{rec.description}</p>
                  <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
                    {rec.estimatedEffort && (
                      <div>
                        <span className="font-medium text-muted-foreground">Estimated Effort: </span>
                        <span className="text-foreground">{rec.estimatedEffort}</span>
                      </div>
                    )}
                    {rec.category && (
                      <div>
                        <span className="font-medium text-muted-foreground">Category: </span>
                        <Badge variant="outline" className="text-xs">
                          {rec.category}
                        </Badge>
                      </div>
                    )}
                  </div>
                  {rec.impact && (
                    <div className="mt-2 p-2 bg-jade/5 rounded text-xs">
                      <span className="font-medium text-jade">Expected Impact: </span>
                      <span className="text-muted-foreground">{rec.impact}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Gap Analysis */}
      {findings.gapAnalysis.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-pumpkin" />
              Gap Analysis
              <Badge variant="secondary" className="ml-2">
                {findings.gapAnalysis.length} gaps
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {findings.gapAnalysis.map((gap, index) => (
                <div key={gap.questionId || index} className="border border-border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h4 className="font-semibold text-foreground text-sm mb-1">{gap.questionText}</h4>
                      <div className="flex items-center space-x-2">
                        {gap.category && (
                          <Badge variant="outline" className="text-xs">
                            {gap.category}
                          </Badge>
                        )}
                        <Badge className={getSeverityColor(gap.gapSeverity)}>
                          {gap.gapSeverity} Gap
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                    <div>
                      <span className="text-muted-foreground">Current: </span>
                      <span className="font-medium text-foreground">{gap.currentScore}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Target: </span>
                      <span className="font-medium text-foreground">{gap.targetScore}%</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Gap: </span>
                      <span className="font-medium text-pumpkin">{gap.targetScore - gap.currentScore}%</span>
                    </div>
                  </div>
                  {gap.impact && (
                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                      <span className="font-medium text-foreground">Impact: </span>
                      <span className="text-muted-foreground">{gap.impact}</span>
                    </div>
                  )}
                  {gap.recommendation && (
                    <div className="mt-2 flex items-start space-x-2">
                      <Lightbulb className="w-4 h-4 text-jade mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Recommendation: </span>
                        {gap.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {findings.nextSteps.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Clock className="w-5 h-5 mr-2 text-icterine" />
              Next Steps
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {findings.nextSteps.map((step, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-6 h-6 rounded-full bg-jade/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-xs font-semibold text-jade">{index + 1}</span>
                  </div>
                  <p className="text-sm text-foreground flex-1">{step}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State - No findings at all */}
      {findings.keyFindings.length === 0 && 
       findings.recommendations.length === 0 && 
       findings.gapAnalysis.length === 0 && 
       findings.nextSteps.length === 0 && (
        <Card>
          <CardContent className="p-12">
            <div className="text-center">
              <FileText className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">No Findings Available</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Findings will be generated as you complete the assessment. Answer more questions to see detailed findings and recommendations.
              </p>
              <Button
                variant="outline"
                onClick={fetchFindings}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh Findings
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

