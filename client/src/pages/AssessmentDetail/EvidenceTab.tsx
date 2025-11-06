import { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  Image, 
  File,
  CheckCircle,
  AlertCircle,
  Plus,
  RefreshCw
} from "lucide-react";
import { apiGet, apiPost } from "../../api";

interface EvidenceFile {
  filename: string;
  originalName: string;
  size: number;
  uploadedAt: string;
  downloadUrl: string;
}

interface EvidenceSummary {
  totalQuestionsWithEvidence: number;
  totalEvidenceFiles: number;
  requiredEvidenceCompleted: number;
  requiredEvidenceTotal: number;
  evidenceCompletionRate: number;
  evidenceByQuestion: Array<{
    questionId: string;
    questionText: string;
    required: boolean;
    evidenceRequired: boolean;
    fileCount: number;
    status: 'COMPLETE' | 'MISSING' | 'PROVIDED' | 'NONE';
  }>;
}

export default function EvidenceTab() {
  const [match, params] = useRoute("/assessments/:id");
  const assessmentId = params?.id;

  const [summary, setSummary] = useState<EvidenceSummary | null>(null);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [questionEvidence, setQuestionEvidence] = useState<{
    evidenceFiles: EvidenceFile[];
    notes: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadNotes, setUploadNotes] = useState("");

  const fetchSummary = async () => {
    if (!assessmentId) return;

    try {
      const data = await apiGet<EvidenceSummary>(`/api/evidence/assessment/${assessmentId}/summary`);
      setSummary(data);
    } catch (error) {
      console.error('Failed to fetch evidence summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionEvidence = async (questionId: string) => {
    if (!assessmentId) return;

    try {
      const data = await apiGet<{
        evidenceFiles: EvidenceFile[];
        notes: string;
      }>(`/api/evidence/${assessmentId}/${questionId}`);
      setQuestionEvidence(data);
    } catch (error) {
      console.error('Failed to fetch question evidence:', error);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [assessmentId]);

  useEffect(() => {
    if (selectedQuestion) {
      fetchQuestionEvidence(selectedQuestion);
    } else {
      setQuestionEvidence(null);
    }
  }, [selectedQuestion]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files || !selectedQuestion || !assessmentId) return;

    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    setUploading(true);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (uploadNotes) formData.append('notes', uploadNotes);

      const response = await fetch(`/api/evidence/upload/${assessmentId}/${selectedQuestion}`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        await fetchQuestionEvidence(selectedQuestion);
        await fetchSummary();
        setUploadNotes("");
        // Clear file input
        event.target.value = "";
      } else {
        throw new Error('Upload failed');
      }
    } catch (error) {
      console.error('File upload failed:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleFileDelete = async (filename: string) => {
    if (!selectedQuestion || !assessmentId) return;

    try {
      await fetch(`/api/evidence/${assessmentId}/${selectedQuestion}/${filename}`, {
        method: 'DELETE'
      });

      await fetchQuestionEvidence(selectedQuestion);
      await fetchSummary();
    } catch (error) {
      console.error('File deletion failed:', error);
    }
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif'].includes(ext || '')) {
      return <Image className="w-4 h-4" />;
    } else if (['pdf', 'doc', 'docx'].includes(ext || '')) {
      return <FileText className="w-4 h-4" />;
    }
    return <File className="w-4 h-4" />;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETE':
        return <Badge className="bg-jade text-white">Complete</Badge>;
      case 'MISSING':
        return <Badge className="bg-pumpkin text-white">Missing</Badge>;
      case 'PROVIDED':
        return <Badge className="bg-sunglow text-black">Provided</Badge>;
      default:
        return <Badge variant="outline">None</Badge>;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-jade mx-auto mb-4" />
          <p className="text-muted-foreground">Loading evidence data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Evidence Summary */}
      <Card data-testid="card-evidence-summary">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="w-5 h-5 mr-2 text-jade" />
            Evidence Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {summary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="text-center" data-testid="stat-total-files">
                <div className="text-2xl font-bold text-foreground" data-testid="text-total-files">
                  {summary.totalEvidenceFiles}
                </div>
                <div className="text-sm text-muted-foreground">Total Files</div>
              </div>
              <div className="text-center" data-testid="stat-questions-with-evidence">
                <div className="text-2xl font-bold text-foreground" data-testid="text-questions-with-evidence">
                  {summary.totalQuestionsWithEvidence}
                </div>
                <div className="text-sm text-muted-foreground">Questions with Evidence</div>
              </div>
              <div className="text-center" data-testid="stat-required-evidence">
                <div className="text-2xl font-bold text-foreground" data-testid="text-required-evidence">
                  {summary.requiredEvidenceCompleted}/{summary.requiredEvidenceTotal}
                </div>
                <div className="text-sm text-muted-foreground">Required Evidence</div>
              </div>
              <div className="text-center" data-testid="stat-completion-rate">
                <div className="text-2xl font-bold text-jade" data-testid="text-completion-rate">
                  {summary.evidenceCompletionRate}%
                </div>
                <div className="text-sm text-muted-foreground">Completion Rate</div>
              </div>
            </div>
          )}

          {summary && summary.requiredEvidenceTotal > 0 && (
            <div className="mb-4" data-testid="progress-evidence">
              <div className="flex justify-between text-sm mb-1">
                <span>Required Evidence Progress</span>
                <span data-testid="text-progress-percentage">{summary.evidenceCompletionRate}%</span>
              </div>
              <Progress value={summary.evidenceCompletionRate} className="h-2" data-testid="progress-bar-evidence" />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Evidence by Question */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Questions List */}
        <Card data-testid="card-questions-list">
          <CardHeader>
            <CardTitle className="text-lg">Questions Requiring Evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2" data-testid="list-questions">
              {summary?.evidenceByQuestion.map((item, index) => (
                <div
                  key={index}
                  data-testid={`question-item-${item.questionId}`}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedQuestion === item.questionId
                      ? 'border-jade bg-jade/5'
                      : 'border-border hover:bg-muted/50'
                  }`}
                  onClick={() => setSelectedQuestion(item.questionId)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate" data-testid={`text-question-${item.questionId}`}>
                        {item.questionText}
                      </p>
                      <div className="flex items-center space-x-2 mt-1">
                        {item.evidenceRequired && (
                          <Badge variant="outline" className="text-xs" data-testid={`badge-required-${item.questionId}`}>Required</Badge>
                        )}
                        <span data-testid={`badge-status-${item.questionId}`}>{getStatusBadge(item.status)}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-2">
                      {item.status === 'COMPLETE' && (
                        <CheckCircle className="w-4 h-4 text-jade" data-testid={`icon-complete-${item.questionId}`} />
                      )}
                      {item.status === 'MISSING' && (
                        <AlertCircle className="w-4 h-4 text-pumpkin" data-testid={`icon-missing-${item.questionId}`} />
                      )}
                      <span className="text-xs text-muted-foreground" data-testid={`text-file-count-${item.questionId}`}>
                        {item.fileCount} files
                      </span>
                    </div>
                  </div>
                </div>
              ))}

              {(!summary?.evidenceByQuestion || summary.evidenceByQuestion.length === 0) && (
                <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-questions">
                  <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No questions require evidence</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Evidence Details */}
        <Card data-testid="card-evidence-details">
          <CardHeader>
            <CardTitle className="text-lg" data-testid="title-evidence-details">
              {selectedQuestion ? 'Evidence Files' : 'Select a Question'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedQuestion ? (
              <div className="space-y-4" data-testid="container-evidence-upload">
                {/* File Upload */}
                <div className="border-2 border-dashed border-border rounded-lg p-4" data-testid="area-file-upload">
                  <div className="text-center">
                    <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
                    <div className="space-y-2">
                      <Input
                        type="file"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.txt,.csv"
                        onChange={handleFileUpload}
                        disabled={uploading}
                        className="mb-2"
                        data-testid="input-file-upload"
                      />
                      <Textarea
                        placeholder="Add notes about this evidence (optional)"
                        value={uploadNotes}
                        onChange={(e) => setUploadNotes(e.target.value)}
                        className="text-sm"
                        rows={2}
                        data-testid="textarea-upload-notes"
                      />
                    </div>
                    {uploading && (
                      <div className="mt-2 text-sm text-muted-foreground" data-testid="text-uploading">
                        Uploading files...
                      </div>
                    )}
                  </div>
                </div>

                {/* Current Evidence Notes */}
                {questionEvidence?.notes && (
                  <div className="p-3 bg-muted/50 rounded-lg" data-testid="container-evidence-notes">
                    <h4 className="text-sm font-medium text-foreground mb-1">Notes:</h4>
                    <p className="text-sm text-muted-foreground" data-testid="text-evidence-notes">{questionEvidence.notes}</p>
                  </div>
                )}

                {/* Uploaded Files */}
                <div className="space-y-2" data-testid="list-evidence-files">
                  {questionEvidence?.evidenceFiles.map((file, index) => (
                    <div
                      key={index}
                      data-testid={`evidence-file-${index}`}
                      className="flex items-center justify-between p-3 border border-border rounded-lg"
                    >
                      <div className="flex items-center space-x-3">
                        {getFileIcon(file.filename)}
                        <div>
                          <p className="text-sm font-medium text-foreground" data-testid={`text-filename-${index}`}>
                            {file.originalName}
                          </p>
                          <p className="text-xs text-muted-foreground" data-testid={`text-file-metadata-${index}`}>
                            {formatFileSize(file.size)} • {new Date(file.uploadedAt).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(file.downloadUrl, '_blank')}
                          data-testid={`button-download-${index}`}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleFileDelete(file.filename)}
                          className="text-red-600 hover:text-red-700"
                          data-testid={`button-delete-${index}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {(!questionEvidence?.evidenceFiles || questionEvidence.evidenceFiles.length === 0) && (
                    <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-evidence">
                      <File className="w-12 h-12 mx-auto mb-4 opacity-50" />
                      <p>No evidence files uploaded</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground" data-testid="empty-state-select-question">
                <Plus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>Select a question to manage evidence files</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}