import { useRoute, Link, useLocation, useParams } from "wouter";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  TrendingUp,
  Shield,
  Target,
  Lightbulb,
  ArrowLeft,
  Upload,
  Edit,
  Building2,
  ChevronRight
} from "lucide-react";
import QuestionsTab from "./AssessmentDetail/QuestionsTab";
import EvidenceTab from "./AssessmentDetail/EvidenceTab";
import AnalyticsTab from "./AssessmentDetail/AnalyticsTab";
import { apiGet } from "@/api";
import { useAuth } from "@/hooks/use-auth";
import ClientContextBanner from "@/components/ClientContextBanner";
import { downloadFile } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface Facility {
  id: string;
  name: string;
  city: string;
  state: string;
  isPrimary: boolean;
}

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
}

interface ClientFacility {
  id: string;
  name: string;
  city: string;
  state: string;
}

interface Assessment {
  id: string;
  title: string;
  description?: string;
  status: string;
  progress: {
    answered: number;
    total: number;
    evidence: number;
  };
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  standard?: {
    code: string;
    name: string;
  };
  intakeFormId?: string;
  lastModified: string;
  created: string;
  type: string;
  framework: string;
  priority: string;
  longDescription: string;
  facility?: Facility;
  clientOrganization?: ClientOrganization;
  clientFacility?: ClientFacility;
  questions?: Array<{id: string}>; // Added for the fix
}

interface FilteringInfo {
  totalAvailableQuestions: number;
  filteredQuestionsCount: number;
  filteringRatio: number;
  applicableRecCodes: string[];
  scopeStatement: string;
  intakeFormId: string;
  lastRefreshed: string;
}

// EvidenceTab is imported from ./AssessmentDetail/EvidenceTab


export default function AssessmentDetail() {
  const [match] = useRoute("/assessments/:id");
  const [, setLocation] = useLocation();
  const params = useParams();
  const assessmentId = match && params ? params.id : null;
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [filteringInfo, setFilteringInfo] = useState<FilteringInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [isEditing, setIsEditing] = useState(false); // Added state for editing
  const [downloadingExport, setDownloadingExport] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    if (!assessmentId) return;
    loadAssessment(assessmentId);
  }, [assessmentId]);

  const loadAssessment = async (id: string) => {
    try {
      setLoading(true);
      setError(null);

      // Validate assessment ID format
      if (!id || id === 'undefined' || id === 'null') {
        throw new Error('Invalid assessment ID provided');
      }

      console.log('Loading assessment with ID:', id);

      // Load assessment details - ensure clean endpoint
      const assessmentData = await apiGet<Assessment>(`/assessments/${id}`);
      console.log('Assessment loaded successfully:', assessmentData);
      setAssessment(assessmentData);

      // If this assessment has an intake form, load filtering info
      if (assessmentData.intakeFormId) {
        try {
          const questionsData = await apiGet<{filtering?: FilteringInfo}>(`/assessments/${id}/questions?intakeFormId=${assessmentData.intakeFormId}`);
          if (questionsData.filtering) {
            setFilteringInfo(questionsData.filtering);
          }
        } catch (filterError) {
          console.warn("Could not load filtering info:", filterError);
        }
      }
    } catch (error) {
      console.error("Error loading assessment:", error);
      setError("Failed to load assessment details");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExport = async (format: 'pdf' | 'excel' | 'word' | 'email', formatName: string) => {
    if (!assessmentId || !assessment) return;
    
    setDownloadingExport(format);
    
    try {
      const filename = `${assessment.title}_${formatName}.${format === 'excel' ? 'xlsx' : format === 'word' ? 'docx' : format === 'email' ? 'txt' : 'pdf'}`;
      await downloadFile(`/api/exports/${assessmentId}/${format}`, filename);
      
      toast({
        title: "Export successful",
        description: `${formatName} downloaded successfully`,
      });
    } catch (error) {
      console.error('Export download error:', error);
      toast({
        title: "Export failed",
        description: error instanceof Error ? error.message : "Failed to download export",
        variant: "destructive",
      });
    } finally {
      setDownloadingExport(null);
    }
  };

  // Fallback assessment data
  const fallbackAssessment = {
    id: assessmentId || "fallback-id",
    title: "Security Assessment 2024",
    description: "Comprehensive security review for Q4 compliance",
    status: "In Progress",
    progress: {
      answered: 24,
      total: 45,
      evidence: 12,
    },
    created: "Dec 15, 2024",
    lastModified: "2 hours ago",
    type: "Security",
    framework: "R2v3",
    priority: "High",
    longDescription: "This comprehensive security assessment covers all aspects of the R2v3 pre-certification requirements. The assessment includes security controls, compliance frameworks, risk management processes, and technical implementation reviews.",
    createdAt: 0,
    updatedAt: 0,
  };


  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-4 bg-muted rounded w-1/2"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !assessment) {
    return (
      <div className="p-6">
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto" />
          <div>
            <h3 className="text-lg font-semibold">Assessment Not Found</h3>
            <p className="text-muted-foreground">{error || "The requested assessment could not be loaded."}</p>
          </div>
          <Button onClick={() => setLocation("/dashboard")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const displayAssessment = assessment || fallbackAssessment;

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "In Progress":
        return "secondary";
      case "Completed":
        return "default";
      case "Not Started":
        return "outline";
      default:
        return "secondary";
    }
  };

  const handleExport = () => {
    // Open exports tab to show export options
    setActiveTab("exports");
  };

  // Questions array properly handled
  const questionIds = assessment.questions && Array.isArray(assessment.questions) 
          ? assessment.questions.map(q => q.id).join(',') 
          : 'No questions';


  return (
    <div className="w-full">
      <ClientContextBanner />
      <div className="py-4 sm:py-6 lg:py-8">
        <div className="flex flex-col gap-4 mb-6 sm:mb-8 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Button variant="ghost" onClick={() => setLocation('/dashboard')} className="self-start min-h-[44px]">
                <ArrowLeft className="h-4 w-4 mr-2" />
                <span className="text-sm sm:text-base">Back to Dashboard</span>
              </Button>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                  {displayAssessment.title}
                </h1>
                {filteringInfo && (
                  <Badge variant="secondary" className="bg-jade/10 text-jade border-jade/20">
                    <Target className="h-3 w-3 mr-1" />
                    Smart Filtered
                  </Badge>
                )}
              </div>
            </div>
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <Button variant="outline" onClick={handleExport} className="min-h-[44px] text-sm sm:text-base">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button variant="outline" onClick={() => loadAssessment(assessment.id)} className="min-h-[44px] text-sm sm:text-base">
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button onClick={() => setIsEditing(!isEditing)} className="min-h-[44px] text-sm sm:text-base">
              <Edit className="h-4 w-4 mr-2" />
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground px-4 sm:px-6 lg:px-8">{displayAssessment.description}</p>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 space-y-6">

          {/* Intelligent Filtering Status */}
          {filteringInfo && (
            <Alert className="border-jade/20 bg-jade/5">
              <Lightbulb className="h-4 w-4 text-jade" />
              <AlertDescription>
                <div className="space-y-2">
                  <div className="font-medium text-jade">Intelligent Question Filtering Active</div>
                  <div className="text-sm text-muted-foreground">
                    <strong>{filteringInfo.filteredQuestionsCount}</strong> of {filteringInfo.totalAvailableQuestions} questions
                    selected based on your business intake ({(filteringInfo.filteringRatio * 100).toFixed(1)}% efficiency).
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Scope:</strong> {filteringInfo.scopeStatement}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <strong>Applicable RECs:</strong> {Array.isArray(filteringInfo.applicableRecCodes) 
                      ? filteringInfo.applicableRecCodes.join(', ') 
                      : 'None specified'}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Client Context Banner - Only show for consultant users viewing client assessments */}
          {user?.tenant?.type === 'CONSULTANT' && assessment?.clientOrganization && (
            <Alert className="mb-4 border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-800" data-testid="alert-client-context">
              <Building2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-blue-900 dark:text-blue-100">Client Assessment:</span>
                  <span className="text-blue-800 dark:text-blue-200" data-testid="text-client-name">
                    {assessment.clientOrganization.legalName}
                  </span>
                  {assessment.clientFacility && (
                    <>
                      <ChevronRight className="h-4 w-4 text-blue-400 dark:text-blue-600" />
                      <span className="text-blue-700 dark:text-blue-300" data-testid="text-facility-name">
                        {assessment.clientFacility.name}
                      </span>
                    </>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-6 overflow-x-auto whitespace-nowrap">
              <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
              <TabsTrigger value="questions" data-testid="tab-questions">Questions
                {filteringInfo && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs bg-jade/10 text-jade">
                    {filteringInfo.filteredQuestionsCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
              <TabsTrigger value="evidence" data-testid="tab-evidence">Evidence</TabsTrigger>
              <TabsTrigger value="findings" data-testid="tab-findings">Findings</TabsTrigger>
              <TabsTrigger value="exports" data-testid="tab-exports">Exports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Progress</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Questions Answered</span>
                          <span className="text-sm font-medium text-foreground" data-testid="text-progress-answered">
                            {assessment.progress.answered} / {assessment.progress.total}
                          </span>
                        </div>
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className="bg-jade h-2 rounded-full"
                            style={{ width: `${(assessment.progress.answered / assessment.progress.total) * 100}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Evidence Uploaded:</span>
                            <span className="font-medium text-foreground ml-2" data-testid="text-evidence-count">
                              {assessment.progress.evidence} files
                            </span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Last Modified:</span>
                            <span className="font-medium text-foreground ml-2">
                              {displayAssessment.lastModified}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Description</h3>
                      <div className="prose prose-sm max-w-none text-muted-foreground">
                        <p>{assessment.longDescription}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="space-y-6">
                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>
                      <div className="space-y-3">
                        <Button
                          className="w-full bg-jade text-white hover:bg-jade/90"
                          data-testid="button-continue-assessment"
                        >
                          Continue Assessment
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          data-testid="button-upload-evidence"
                        >
                          <Upload className="w-4 h-4 mr-2" />
                          Upload Evidence
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full"
                          data-testid="button-view-report"
                        >
                          <FileText className="w-4 h-4 mr-2" />
                          View Report
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Info</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="font-medium text-foreground">{displayAssessment.created}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Type:</span>
                          <span className="font-medium text-foreground">{displayAssessment.type}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Framework:</span>
                          <span className="font-medium text-foreground">{displayAssessment.framework}</span>
                        </div>
                        {assessment.facility && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Facility:</span>
                            <div className="text-right">
                              <div className="font-medium text-foreground flex items-center">
                                {assessment.facility.name}
                                {assessment.facility.isPrimary && (
                                  <Badge variant="outline" className="ml-2 text-xs">Primary</Badge>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {assessment.facility.city}, {assessment.facility.state}
                              </div>
                            </div>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Priority:</span>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pumpkin/10 text-pumpkin">
                            {displayAssessment.priority}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="questions" className="mt-6">
              <QuestionsTab
                assessmentId={assessment.id}
                intakeFormId={assessment.intakeFormId}
                filteringInfo={filteringInfo}
              />
            </TabsContent>

            <TabsContent value="evidence" className="mt-6">
              <EvidenceTab />
            </TabsContent>

            <TabsContent value="analytics" className="mt-6">
              <AnalyticsTab assessmentId={assessment.id} intakeFormId={assessment.intakeFormId} />
            </TabsContent>

            <TabsContent value="findings">
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Findings</h3>
                  <p className="text-muted-foreground">Findings and recommendations will be displayed here.</p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="exports">
              <div className="space-y-6">
                {/* Export Overview */}
                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Professional R2v3 Export Suite</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                      <div className="glass-morphism p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">📄 PDF Report</h4>
                        <p className="text-sm text-muted-foreground">Technical assessment report with detailed findings</p>
                      </div>
                      <div className="glass-morphism p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">📊 Excel Dashboard</h4>
                        <p className="text-sm text-muted-foreground">Management dashboard with analytics and progress tracking</p>
                      </div>
                      <div className="glass-morphism p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">📝 Word Summary</h4>
                        <p className="text-sm text-muted-foreground">Executive summary for stakeholder presentations</p>
                      </div>
                      <div className="glass-morphism p-4 rounded-lg">
                        <h4 className="font-medium text-foreground mb-2">✉️ Email Template</h4>
                        <p className="text-sm text-muted-foreground">Professional consultation email with results</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Export Actions */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* PDF Technical Report */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-red-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">PDF Technical Report</h4>
                          <p className="text-sm text-muted-foreground">Comprehensive R2v3 assessment report</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">Professional PDF</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Content:</span>
                          <span className="font-medium">All questions & answers</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Use Case:</span>
                          <span className="font-medium">Audit submission</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadExport('pdf', 'Technical Report')}
                        disabled={downloadingExport === 'pdf'}
                        className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        data-testid="button-download-pdf"
                      >
                        {downloadingExport === 'pdf' ? 'Downloading...' : 'Download PDF Report'}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Excel Management Dashboard */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">Excel Management Dashboard</h4>
                          <p className="text-sm text-muted-foreground">Interactive spreadsheet with analytics</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">Excel Workbook</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Content:</span>
                          <span className="font-medium">Multi-sheet dashboard</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Use Case:</span>
                          <span className="font-medium">Management review</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadExport('excel', 'Management Dashboard')}
                        disabled={downloadingExport === 'excel'}
                        className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        data-testid="button-download-excel"
                      >
                        {downloadingExport === 'excel' ? 'Downloading...' : 'Download Excel Dashboard'}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Word Executive Summary */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">Word Executive Summary</h4>
                          <p className="text-sm text-muted-foreground">Concise summary for stakeholders</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">Microsoft Word</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Content:</span>
                          <span className="font-medium">Executive overview</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Use Case:</span>
                          <span className="font-medium">Board presentations</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadExport('word', 'Executive Summary')}
                        disabled={downloadingExport === 'word'}
                        className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        data-testid="button-download-word"
                      >
                        {downloadingExport === 'word' ? 'Downloading...' : 'Download Word Summary'}
                      </button>
                    </CardContent>
                  </Card>

                  {/* Email Consultation Template */}
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                        </div>
                        <div>
                          <h4 className="font-semibold text-foreground">Email Consultation</h4>
                          <p className="text-sm text-muted-foreground">Professional client communication</p>
                        </div>
                      </div>
                      <div className="space-y-3 mb-4">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Format:</span>
                          <span className="font-medium">Email Template</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Content:</span>
                          <span className="font-medium">Results & next steps</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Use Case:</span>
                          <span className="font-medium">Client communication</span>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadExport('email', 'Client Communication')}
                        disabled={downloadingExport === 'email'}
                        className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed text-white font-medium py-2 px-4 rounded-lg transition-colors"
                        data-testid="button-download-email"
                      >
                        {downloadingExport === 'email' ? 'Downloading...' : 'Download Email Template'}
                      </button>
                    </CardContent>
                  </Card>
                </div>

                {/* Export Guidelines */}
                <Card>
                  <CardContent className="p-6">
                    <h4 className="font-semibold text-foreground mb-4">Export Guidelines & Best Practices</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h5 className="font-medium text-foreground mb-2">🎯 For Certification Audits</h5>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Use PDF Technical Report for official submission</li>
                          <li>• Include all evidence attachments</li>
                          <li>• Ensure complete question coverage</li>
                        </ul>
                      </div>
                      <div>
                        <h5 className="font-medium text-foreground mb-2">👔 For Management Review</h5>
                        <ul className="text-sm text-muted-foreground space-y-1">
                          <li>• Excel Dashboard provides interactive analysis</li>
                          <li>• Word Summary for board presentations</li>
                          <li>• Focus on compliance gaps and timelines</li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* System Status */}
                <Card>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-foreground">Export System Status</h4>
                        <p className="text-sm text-muted-foreground">All templates validated and ready for professional use</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <span className="text-sm font-medium text-green-600">Operational</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}