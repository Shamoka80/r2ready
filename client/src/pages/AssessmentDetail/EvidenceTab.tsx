import { useState, useEffect, useRef } from "react";
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
  id: string;
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

  const [summary, setSummary] = useState<EvidenceSummary | null>({
    totalQuestionsWithEvidence: 0,
    totalEvidenceFiles: 0,
    requiredEvidenceCompleted: 0,
    requiredEvidenceTotal: 0,
    evidenceCompletionRate: 0,
    evidenceByQuestion: []
  });
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [questionEvidence, setQuestionEvidence] = useState<{
    evidenceFiles: EvidenceFile[];
    notes: string;
  } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploadNotes, setUploadNotes] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSummary = async (forceRefresh = false) => {
    if (!assessmentId) return;

    try {
      // Add cache-busting parameter to force fresh data
      const url = forceRefresh 
        ? `/api/evidence/assessment/${assessmentId}/summary?_t=${Date.now()}`
        : `/api/evidence/assessment/${assessmentId}/summary`;
      
      const data = await apiGet<EvidenceSummary>(url);
      // Ensure evidenceByQuestion is always an array
      setSummary({
        ...data,
        evidenceByQuestion: data.evidenceByQuestion || []
      });
      console.log('📊 Summary updated:', {
        totalQuestions: data.evidenceByQuestion?.length || 0,
        questionsWithFiles: data.evidenceByQuestion?.filter(q => q.fileCount > 0).length || 0,
        fileCounts: data.evidenceByQuestion?.map(q => ({ 
          questionId: q.questionId.substring(0, 8) + '...', 
          fileCount: q.fileCount,
          status: q.status
        })) || []
      });
    } catch (error) {
      console.error('Failed to fetch evidence summary:', error);
      // Set empty summary on error to prevent undefined errors
      setSummary({
        totalQuestionsWithEvidence: 0,
        totalEvidenceFiles: 0,
        requiredEvidenceCompleted: 0,
        requiredEvidenceTotal: 0,
        evidenceCompletionRate: 0,
        evidenceByQuestion: []
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchQuestionEvidence = async (questionId: string) => {
    if (!assessmentId) return;

    try {
      const response = await apiGet<{
        data: Array<{
          id: string;
          originalName: string;
          size: number;
          uploadedAt: string | Date;
          downloadUrl: string;
          mimeType?: string;
        }>;
        notes: string | null;
      }>(`/api/evidence/${assessmentId}/${questionId}`);
      
      // Map the API response format to what the component expects
      const mappedFiles: EvidenceFile[] = (response.data || []).map(file => ({
        id: file.id,
        filename: file.originalName, // Use originalName as filename for display
        originalName: file.originalName,
        size: file.size,
        uploadedAt: typeof file.uploadedAt === 'string' ? file.uploadedAt : file.uploadedAt.toISOString(),
        downloadUrl: file.downloadUrl
      }));
      
      setQuestionEvidence({
        evidenceFiles: mappedFiles,
        notes: response.notes || ''
      });
    } catch (error) {
      console.error('Failed to fetch question evidence:', error);
      setQuestionEvidence({
        evidenceFiles: [],
        notes: ''
      });
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [assessmentId]);

  useEffect(() => {
    if (selectedQuestion) {
      console.log('🔄 Question selected:', selectedQuestion);
      // Refresh summary when switching questions to ensure file counts are up to date
      fetchSummary(true); // Force refresh to show current file counts
      fetchQuestionEvidence(selectedQuestion);
      // Reset upload state when switching questions
      setUploadNotes("");
      setUploading(false);
      setUploadError(null);
      // Reset file input when switching questions - use setTimeout to ensure DOM is ready
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
          console.log('✅ File input reset for question:', selectedQuestion);
        }
      }, 0);
    } else {
      setQuestionEvidence(null);
      setUploadNotes("");
      setUploadError(null);
      setUploading(false);
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }, 0);
    }
  }, [selectedQuestion]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('📎 File upload triggered:', {
      hasFiles: !!event.target.files,
      fileCount: event.target.files?.length || 0,
      selectedQuestion,
      assessmentId,
      uploading
    });

    if (!event.target.files || !selectedQuestion || !assessmentId) {
      const errorMsg = !selectedQuestion ? "Please select a question first" : "Missing assessment ID";
      setUploadError(errorMsg);
      console.error('❌ Upload blocked:', errorMsg);
      return;
    }

    if (uploading) {
      setUploadError("Please wait for the current upload to complete");
      console.warn('⚠️ Upload already in progress');
      return;
    }

    const files = Array.from(event.target.files);
    if (files.length === 0) {
      setUploadError("Please select at least one file");
      return;
    }

    setUploading(true);
    setUploadError(null);

    try {
      const formData = new FormData();
      files.forEach(file => formData.append('files', file));
      if (uploadNotes) formData.append('notes', uploadNotes);

      // Get auth token for file upload
      const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      } else {
        console.error('❌ No auth token found in localStorage');
        setUploadError('Authentication required. Please log in again.');
        setUploading(false);
        return;
      }

      console.log('📤 Uploading files:', {
        assessmentId,
        questionId: selectedQuestion,
        fileCount: files.length,
        hasToken: !!token,
        tokenLength: token?.length || 0
      });

      // Don't set Content-Type for FormData - browser will set it with boundary
      const response = await fetch(`/api/evidence/upload/${assessmentId}/${selectedQuestion}`, {
        method: 'POST',
        headers,
        body: formData
      });

      console.log('📥 Upload response:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      if (response.ok) {
        const responseData = await response.json().catch(() => ({}));
        console.log('✅ Upload successful:', responseData);
        
        // Small delay to ensure files are fully saved to database before refreshing
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Refresh evidence for current question and update summary (force refresh to bypass cache)
        await Promise.all([
          fetchQuestionEvidence(selectedQuestion),
          fetchSummary(true) // Force refresh to get updated file counts
        ]);
        
        setUploadNotes("");
        setUploadError(null);
        setUploading(false); // Ensure uploading is reset
        
        // Clear file input - use setTimeout to ensure it happens after state updates
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.value = "";
          }
          if (event.target) {
            event.target.value = "";
          }
        }, 100);
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        const errorMessage = errorData.error || errorData.message || 'Upload failed';
        console.error('❌ Upload failed:', errorMessage);
        setUploadError(errorMessage);
        setUploading(false);
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('File upload error:', error);
      setUploadError(error instanceof Error ? error.message : 'Failed to upload files. Please try again.');
      setUploading(false); // Always reset uploading state on error
    }
  };

  const handleFileDelete = async (evidenceId: string) => {
    if (!selectedQuestion || !assessmentId) return;

    try {
      // Get auth token for delete request
      const token = localStorage.getItem('auth_token') || localStorage.getItem('auth-token');
      const headers: Record<string, string> = {};
      
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`/api/evidence/evidence/${evidenceId}`, {
        method: 'DELETE',
        headers
      });

      if (response.ok) {
        await fetchQuestionEvidence(selectedQuestion);
        await fetchSummary();
      } else {
        const errorData = await response.json().catch(() => ({ error: 'Delete failed' }));
        console.error('File deletion failed:', errorData.error || 'Unknown error');
      }
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
              {(summary?.evidenceByQuestion || []).map((item, index) => (
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
                        ref={fileInputRef}
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
                    {uploadError && (
                      <div className="mt-2 text-sm text-pumpkin" data-testid="text-upload-error">
                        {uploadError}
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
                  {(questionEvidence?.evidenceFiles || []).map((file, index) => (
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
                          onClick={() => handleFileDelete(file.id)}
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