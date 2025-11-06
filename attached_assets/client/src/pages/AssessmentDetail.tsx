import { useState } from "react";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Upload, FileText } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function AssessmentDetail() {
  const [match, params] = useRoute("/assessments/:id");
  const assessmentId = params?.id;

  // Mock assessment data
  const assessment = {
    id: assessmentId,
    name: "Security Assessment 2024",
    description: "Comprehensive security review for Q4 compliance",
    status: "In Progress",
    lastModified: "2 hours ago",
    created: "Dec 15, 2024",
    type: "Security",
    framework: "R2v3",
    priority: "High",
    progress: {
      answered: 24,
      total: 45,
      evidence: 12,
    },
    longDescription: "This comprehensive security assessment covers all aspects of the R2v3 pre-certification requirements. The assessment includes security controls, compliance frameworks, risk management processes, and technical implementation reviews.",
  };

  if (!match) return null;

  return (
    <div>
      {/* Header */}
      <div className="border-b border-border bg-white">
        <div className="px-6 py-4">
          <div className="flex items-center space-x-4">
            <Link href="/dashboard">
              <button className="p-2 hover:bg-muted rounded-md transition-colors" data-testid="button-back">
                <ArrowLeft className="w-5 h-5 text-dimgrey" />
              </button>
            </Link>
            <div className="flex-1">
              <h2 className="text-xl font-bold text-foreground" data-testid="text-assessment-title">
                {assessment.name}
              </h2>
              <p className="text-sm text-dimgrey">{assessment.description}</p>
            </div>
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-sunglow/10 text-sunglow">
              {assessment.status}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 py-6">
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="questions" data-testid="tab-questions">Questions</TabsTrigger>
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
                        <span className="text-sm text-dimgrey">Questions Answered</span>
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
                          <span className="text-dimgrey">Evidence Uploaded:</span>
                          <span className="font-medium text-foreground ml-2" data-testid="text-evidence-count">
                            {assessment.progress.evidence} files
                          </span>
                        </div>
                        <div>
                          <span className="text-dimgrey">Last Modified:</span>
                          <span className="font-medium text-foreground ml-2">
                            {assessment.lastModified}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Description</h3>
                    <div className="prose prose-sm max-w-none text-dimgrey">
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
                        <span className="text-dimgrey">Created:</span>
                        <span className="font-medium text-foreground">{assessment.created}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dimgrey">Type:</span>
                        <span className="font-medium text-foreground">{assessment.type}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dimgrey">Framework:</span>
                        <span className="font-medium text-foreground">{assessment.framework}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-dimgrey">Priority:</span>
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-pumpkin/10 text-pumpkin">
                          {assessment.priority}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="questions">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Questions</h3>
                <p className="text-dimgrey">Questions functionality will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="evidence">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Evidence Management</h3>
                <p className="text-dimgrey">Evidence upload and management functionality will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="findings">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Findings</h3>
                <p className="text-dimgrey">Findings and recommendations will be displayed here.</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="exports">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-foreground mb-4">Export Options</h3>
                <p className="text-dimgrey">Export functionality will be implemented here.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
