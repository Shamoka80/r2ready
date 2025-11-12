import { useEffect, useState, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RefreshCw, CheckCircle, Clock, Target, TrendingUp, AlertCircle, Lightbulb } from "lucide-react";
import { apiGet, apiPost } from "../../api";

interface Question {
  id: string;
  questionId: string;
  text: string;
  required: boolean;
  evidenceRequired: boolean;
  responseType: string;
  appendix: string | null;
  category: string | null;
  category_code: string | null;
  category_name: string | null;
  answer: any; // Answer from backend (JSON value)
}

interface ClauseGroup {
  clauseRef: string;
  clauseTitle: string;
  questions: Question[];
}

interface QuestionsResponse {
  assessmentId: string;
  standardCode: string;
  groups: ClauseGroup[];
  totalQuestions: number;
  requiredCount: number;
  filtering?: {
    totalAvailableQuestions: number;
    filteredQuestionsCount: number;
    filteringRatio: number;
    applicableRecCodes: string[];
    scopeStatement: string;
    intakeFormId: string;
    lastRefreshed: string;
  };
  progress?: {
    totalQuestions: number;
    answeredQuestions: number;
    progressPercentage: number;
    requiredQuestions: number;
    answeredRequiredQuestions: number;
    requiredProgressPercentage: number;
    isComplete: boolean;
    lastUpdated: string;
  };
  scoring?: {
    overallScore: number;
    complianceStatus: 'COMPLIANT' | 'PARTIAL' | 'NON_COMPLIANT' | 'INCOMPLETE';
    readinessLevel: 'AUDIT_READY' | 'NEEDS_IMPROVEMENT' | 'MAJOR_GAPS' | 'NOT_READY';
    estimatedAuditSuccess: number;
    criticalIssuesCount: number;
    topRecommendations: string[];
    lastCalculated: string;
  };
}

interface Answer {
  questionId: string;
  value: string;
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface QuestionsTabProps {
  assessmentId: string;
  intakeFormId?: string;
  filteringInfo?: {
    totalAvailableQuestions: number;
    filteredQuestionsCount: number;
    filteringRatio: number;
    applicableRecCodes: string[];
    scopeStatement: string;
    intakeFormId: string;
    lastRefreshed: string;
  } | null;
}

export default function QuestionsTab({ assessmentId, intakeFormId, filteringInfo }: QuestionsTabProps) {
  const [match, params] = useRoute("/assessments/:id");
  // assessmentId is already available via params.id if not passed as prop
  const currentAssessmentId = assessmentId || params?.id;

  const [questionsData, setQuestionsData] = useState<QuestionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Local answer state keyed by questionId (display code)
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [saveStatuses, setSaveStatuses] = useState<Record<string, SaveStatus>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
  // Mapping from questionId (display code like "Q141") to id (UUID)
  const questionIdToUuidMap = useRef<Record<string, string>>({});

  const debounceTimeout = useRef<ReturnType<typeof setTimeout>>();
  const pendingAnswers = useRef<Map<string, number>>(new Map()); // questionId -> revision
  const revisionCounter = useRef<number>(0);
  const progressRefreshInterval = useRef<ReturnType<typeof setTimeout>>();
  const retryTimeouts = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const isMounted = useRef(true);
  const currentAnswersRef = useRef(answers);
  const currentAssessmentIdRef = useRef(currentAssessmentId);

  // Keep refs updated with current values
  useEffect(() => {
    currentAnswersRef.current = answers;
  }, [answers]);

  useEffect(() => {
    currentAssessmentIdRef.current = currentAssessmentId;
  }, [currentAssessmentId]);

  // Load questions on mount
  useEffect(() => {
    if (!currentAssessmentId) return;

    const loadQuestions = async () => {
      try {
        setLoading(true);
        let url = `/api/assessments/${currentAssessmentId}/questions`;
        if (intakeFormId) {
          url += `?intakeFormId=${intakeFormId}`;
        }

        const response = await apiGet<QuestionsResponse>(url);
        setQuestionsData(response);

        // Build mapping from questionId (display code) to id (UUID)
        const idMap: Record<string, string> = {};
        // Initialize answers from backend data
        const initialAnswers: Record<string, string> = {};
        response.groups.forEach(group => {
          group.questions.forEach(question => {
            // Map display code to UUID
            idMap[question.questionId] = question.id;
            if (question.answer && question.answer.value !== null && question.answer.value !== undefined) {
              initialAnswers[question.questionId] = String(question.answer.value);
            }
          });
        });
        questionIdToUuidMap.current = idMap;
        setAnswers(initialAnswers);

        setError(null);
      } catch (_err) {
        setError(_err instanceof Error ? _err.message : 'Failed to load questions');
      } finally {
        setLoading(false);
      }
    };

    loadQuestions();
  }, [currentAssessmentId, intakeFormId]);

  // Debounced batch save function
  const savePendingAnswers = useCallback(async () => {
    if (!currentAssessmentIdRef.current || pendingAnswers.current.size === 0) return;

    // Use ref to get latest answers state (avoid stale closure)
    const currentAnswers = currentAnswersRef.current;

    // Snapshot the pending queue with revisions for this batch
    const batchToSave = new Map(pendingAnswers.current);
    const answersToSave: Answer[] = Array.from(batchToSave.keys())
      .filter(questionId => currentAnswers[questionId] !== undefined)
      .map(questionId => ({
        questionId: questionIdToUuidMap.current[questionId] || questionId, // Use UUID from map
        value: currentAnswers[questionId]!
      }));

    // Mark all pending as saving (use original questionId for status tracking)
    const statusUpdates: Record<string, SaveStatus> = {};
    const displayCodeIds = Array.from(batchToSave.keys());
    displayCodeIds.forEach((questionId) => {
      statusUpdates[questionId] = 'saving';
    });
    setSaveStatuses(prev => ({ ...prev, ...statusUpdates }));

    try {
      await apiPost<{ upserted: number }>(`/api/answers/${currentAssessmentIdRef.current}/answers/batch`, {
        answers: answersToSave
      });

      // Mark all as saved (use original questionId for status tracking)
      displayCodeIds.forEach((questionId) => {
        statusUpdates[questionId] = 'saved';
      });
      setSaveStatuses(prev => ({ ...prev, ...statusUpdates }));

      // Only clear pending answers that match the saved revision (prevent race condition)
      displayCodeIds.forEach((questionId) => {
        const savedRevision = batchToSave.get(questionId);
        const currentRevision = pendingAnswers.current.get(questionId);
        // Only clear if the revision matches (no newer edit was queued)
        if (currentRevision === savedRevision) {
          pendingAnswers.current.delete(questionId);
        }
      });

      // Cancel any retry timers for successfully saved answers
      displayCodeIds.forEach((questionId) => {
        if (retryTimeouts.current.has(questionId)) {
          clearTimeout(retryTimeouts.current.get(questionId)!);
          retryTimeouts.current.delete(questionId);
        }
      });

      // Clear errors for successfully saved questions (shared success path)
      setSaveErrors(prev => {
        const newErrors = { ...prev };
        displayCodeIds.forEach((questionId) => {
          delete newErrors[questionId];
        });
        return newErrors;
      });

      // Auto-hide saved status after 2 seconds
      setTimeout(() => {
        setSaveStatuses(prev => {
          const newStatuses = { ...prev };
          displayCodeIds.forEach((questionId) => {
            if (newStatuses[questionId] === 'saved') {
              newStatuses[questionId] = 'idle';
            }
          });
          return newStatuses;
        });
      }, 2000);

    } catch (error) {
      console.error('Failed to save answers:', error);

      // Determine error message
      let errorMessage = 'Failed to save';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }

      // Mark all as error with specific message (use original questionId for status tracking)
      const errorUpdates: Record<string, string> = {};
      displayCodeIds.forEach((questionId) => {
        statusUpdates[questionId] = 'error';
        errorUpdates[questionId] = errorMessage;
      });
      setSaveStatuses(prev => ({ ...prev, ...statusUpdates }));
      setSaveErrors(prev => ({ ...prev, ...errorUpdates }));

      // Implement exponential backoff retry for failed saves
      displayCodeIds.forEach((questionId) => {
        const retryCount = 0; // First retry
        const currentRevision = batchToSave.get(questionId);
        if (currentRevision !== undefined) {
          scheduleRetry(questionId, retryCount, currentRevision);
        }
      });
    }
  }, []); // No dependencies - uses refs to avoid stale closures

  // Exponential backoff retry logic
  const scheduleRetry = useCallback((questionId: string, retryCount: number, originalRevision: number) => {
    const maxRetries = 3;
    if (retryCount >= maxRetries) {
      // Max retries reached, give up
      return;
    }

    // Calculate delay: 1s, 2s, 4s for retries 0, 1, 2
    const delay = Math.pow(2, retryCount) * 1000;

    const timeoutId = setTimeout(async () => {
      if (!isMounted.current) return;

      try {
        // Check if a newer revision was queued while retry was pending
        const currentRevision = pendingAnswers.current.get(questionId);
        if (currentRevision !== originalRevision) {
          // A newer edit was made, abort this retry
          retryTimeouts.current.delete(questionId);
          return;
        }

        // Get the current answer value (not stale from closure)
        const currentAnswer = currentAnswersRef.current[questionId];
        if (currentAnswer === undefined || !currentAssessmentIdRef.current) return;

        setSaveStatuses(prev => ({ ...prev, [questionId]: 'saving' }));

        // Map display code to UUID for API
        const questionUuid = questionIdToUuidMap.current[questionId] || questionId;
        await apiPost<{ upserted: number }>(`/api/answers/${currentAssessmentIdRef.current}/answers/batch`, {
          answers: [{ questionId: questionUuid, value: currentAnswer }]
        });

        // Success - clear error and set saved
        if (isMounted.current) {
          setSaveStatuses(prev => ({ ...prev, [questionId]: 'saved' }));

          // Clear error for this question (retry success path)
          setSaveErrors(prev => {
            const newErrors = { ...prev };
            delete newErrors[questionId];
            return newErrors;
          });

          // Clear from pending queue only if revision matches (retry success path)
          const currentPendingRevision = pendingAnswers.current.get(questionId);
          if (currentPendingRevision === originalRevision) {
            pendingAnswers.current.delete(questionId);
          }

          // Auto-hide saved status after 2 seconds
          setTimeout(() => {
            if (isMounted.current) {
              setSaveStatuses(prev => 
                prev[questionId] === 'saved' ? { ...prev, [questionId]: 'idle' } : prev
              );
            }
          }, 2000);
        }

        retryTimeouts.current.delete(questionId);
      } catch (error) {
        if (!isMounted.current) return;

        console.warn(`Retry ${retryCount + 1} failed for question ${questionId}:`, error);

        // Schedule next retry with same revision
        scheduleRetry(questionId, retryCount + 1, originalRevision);
      }
    }, delay);

    retryTimeouts.current.set(questionId, timeoutId);
  }, []); // No dependencies - uses refs to avoid stale closures

  // Handle answer change with debouncing
  const handleAnswerChange = useCallback((questionId: string, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));

    // Add to pending queue with new revision
    revisionCounter.current++;
    pendingAnswers.current.set(questionId, revisionCounter.current);

    // Cancel any existing retry timer for this question to prevent stale data overwrites
    if (retryTimeouts.current.has(questionId)) {
      clearTimeout(retryTimeouts.current.get(questionId)!);
      retryTimeouts.current.delete(questionId);
    }

    // Clear any error state since user is typing again
    setSaveStatuses(prev => ({ ...prev, [questionId]: 'idle' }));
    setSaveErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });

    // Clear existing debounce timeout
    if (debounceTimeout.current) {
      clearTimeout(debounceTimeout.current);
    }

    // Set new timeout (2s allows better batching of rapid edits)
    debounceTimeout.current = setTimeout(savePendingAnswers, 2000);
  }, [savePendingAnswers]);

  // Progress refresh functionality
  const refreshProgress = useCallback(async () => {
    if (!currentAssessmentId || !questionsData?.filtering?.intakeFormId) return;

    try {
      const progressData = await apiGet<any>(`/api/assessments/${currentAssessmentId}/progress?intakeFormId=${questionsData.filtering.intakeFormId}`);
      if (questionsData.progress && progressData) {
        setQuestionsData(prev => prev ? {
          ...prev,
          progress: progressData
        } : null);
      }
    } catch (error) {
      console.warn('Failed to refresh progress:', error);
    }
  }, [currentAssessmentId, questionsData?.filtering?.intakeFormId]);

  // Auto-refresh progress every 30 seconds if filtering is enabled
  useEffect(() => {
    if (questionsData?.filtering?.intakeFormId) {
      progressRefreshInterval.current = setInterval(refreshProgress, 30000);
      return () => {
        if (progressRefreshInterval.current) {
          clearInterval(progressRefreshInterval.current);
        }
      };
    }
  }, [questionsData?.filtering?.intakeFormId, refreshProgress]);

  // Manual refresh filtering
  const handleRefreshFiltering = useCallback(async () => {
    if (!intakeFormId) return;

    setRefreshing(true);
    try {
      await apiPost(`/api/assessments/${currentAssessmentId}/refresh-filtering`, {
        intakeFormId
      });

      // Reload questions with fresh filtering
      const queryParams = `?intakeFormId=${intakeFormId}&refreshFiltering=true`;
      const data = await apiGet<QuestionsResponse>(`/api/assessments/${currentAssessmentId}/questions${queryParams}`);
      setQuestionsData(data);
    } catch (error) {
      console.error('Failed to refresh filtering:', error);
    } finally {
      setRefreshing(false);
    }
  }, [currentAssessmentId, intakeFormId]);

  // Proper cleanup on unmount - empty dependency array to prevent running on every render
  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;

      // Clear all timers
      if (debounceTimeout.current) {
        clearTimeout(debounceTimeout.current);
      }
      if (progressRefreshInterval.current) {
        clearInterval(progressRefreshInterval.current);
      }

      // Clear retry timers
      retryTimeouts.current.forEach(timeoutId => clearTimeout(timeoutId));
      retryTimeouts.current.clear();

      // For pending answers, try to persist synchronously using refs for current values
      if (pendingAnswers.current.size > 0 && currentAssessmentIdRef.current) {
        const answersToSave = Array.from(pendingAnswers.current.keys()).map(questionId => ({
          questionId,
          value: currentAnswersRef.current[questionId] || ''
        }));

        // Use authenticated fetch with keepalive instead of sendBeacon
        // sendBeacon doesn't send Authorization headers, causing 401 errors
        try {
          fetch(`/api/answers/${currentAssessmentIdRef.current}/answers/batch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('auth_token')}`,
            },
            body: JSON.stringify({ answers: answersToSave }),
            keepalive: true
          }).catch(error => console.warn('Authenticated unload save failed:', error));
        } catch (error) {
          console.warn('Failed to persist answers on unmount:', error);
        }
      }
    };
  }, []); // Empty dependency array - only runs on true unmount

  if (!currentAssessmentId) return null;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-muted-foreground">Loading questions...</p>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-center text-red-600">Error: {error}</p>
        </CardContent>
      </Card>
    );
  }

  if (!questionsData) return null;

  const renderQuestion = (question: Question) => {
    const questionFieldId = `question-${question.questionId}`;
    const currentAnswer = answers[question.questionId] || '';
    const saveStatus = saveStatuses[question.questionId] || 'idle';
    const saveError = saveErrors[question.questionId];

    if (question.responseType === 'yes_no') {
      return (
        <div className="space-y-3" role="group" aria-labelledby={questionFieldId}>
          <Label
            id={questionFieldId}
            className="text-sm font-medium text-foreground"
            data-testid={`q-${question.questionId}-label`}
          >
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>

          <RadioGroup
            value={currentAnswer}
            onValueChange={(value) => handleAnswerChange(question.questionId, value)}
            className="flex gap-6"
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="Yes"
                id={`${questionFieldId}-yes`}
                data-testid={`q-${question.questionId}-yes`}
              />
              <Label htmlFor={`${questionFieldId}-yes`} className="text-sm">
                Yes
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem
                value="No"
                id={`${questionFieldId}-no`}
                data-testid={`q-${question.questionId}-no`}
              />
              <Label htmlFor={`${questionFieldId}-no`} className="text-sm">
                No
              </Label>
            </div>
          </RadioGroup>

          <div className="flex items-center space-x-2 text-xs">
            {saveStatus === 'saving' && (
              <span className="text-blue-600 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-600 flex items-center" title={saveError}>
                <AlertCircle className="w-3 h-3 mr-1" />
                Error{saveError ? ` - ${saveError}` : ''}
              </span>
            )}
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-3">
          <Label
            htmlFor={questionFieldId}
            className="text-sm font-medium text-foreground"
            data-testid={`q-${question.questionId}-label`}
          >
            {question.text}
            {question.required && <span className="text-red-500 ml-1">*</span>}
          </Label>

          <Input
            id={questionFieldId}
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(question.questionId, e.target.value)}
            placeholder="Enter your answer..."
            className="w-full"
            data-testid={`q-${question.questionId}-input`}
          />

          <div className="flex items-center space-x-2 text-xs">
            {saveStatus === 'saving' && (
              <span className="text-blue-600 flex items-center">
                <Clock className="w-3 h-3 mr-1" />
                Saving...
              </span>
            )}
            {saveStatus === 'saved' && (
              <span className="text-green-600 flex items-center">
                <CheckCircle className="w-3 h-3 mr-1" />
                Saved
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="text-red-600 flex items-center" title={saveError}>
                <AlertCircle className="w-3 h-3 mr-1" />
                Error{saveError ? ` - ${saveError}` : ''}
              </span>
            )}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* Enhanced Filtering Status Banner */}
      {filteringInfo && (
        <Alert className="border-jade/20 bg-jade/5">
          <Target className="h-4 w-4 text-jade" />
          <AlertDescription>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-jade">🎯 Smart Assessment Filtering Active</div>
                <Badge variant="secondary" className="bg-jade/10 text-jade">
                  {(filteringInfo.filteringRatio * 100).toFixed(1)}% efficiency
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <span className="font-medium">Questions:</span>
                  <span className="ml-2">{filteringInfo.filteredQuestionsCount} of {filteringInfo.totalAvailableQuestions}</span>
                </div>
                <div>
                  <span className="font-medium">RECs Applied:</span>
                  <span className="ml-2">{filteringInfo.applicableRecCodes?.length || 0}</span>
                </div>
                <div>
                  <span className="font-medium">Time Saved:</span>
                  <span className="ml-2 text-jade">~{Math.round((1 - filteringInfo.filteringRatio) * 100)}% reduction</span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground border-t pt-2">
                <strong>Assessment Scope:</strong> {filteringInfo.scopeStatement}
              </div>

              {filteringInfo.applicableRecCodes && filteringInfo.applicableRecCodes.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-jade hover:text-jade/80">
                    View Applied REC Codes ({filteringInfo.applicableRecCodes.length})
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {filteringInfo.applicableRecCodes.map((rec: string) => (
                      <Badge key={rec} variant="outline" className="text-xs border-jade/20 text-jade">
                        {rec}
                      </Badge>
                    ))}
                  </div>
                </details>
              )}

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Last updated: {new Date(filteringInfo.lastRefreshed).toLocaleString()}</span>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                  className="h-6 px-2 text-xs"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Refresh
                </Button>
              </div>
            </div>
          </AlertDescription>
        </Alert>
      )}

      {/* Enhanced Progress Overview with Smart Insights & Scoring */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-jade" />
            Smart Progress Overview & Scoring
            {filteringInfo && (
              <Badge variant="secondary" className="ml-2 bg-jade/10 text-jade">
                <Target className="h-3 w-3 mr-1" />
                Filtered
              </Badge>
            )}
            {questionsData.scoring && (
              <Badge variant="outline" className="ml-2">
                Score: {questionsData.scoring.overallScore}%
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Scoring Metrics */}
            {questionsData.scoring && (
              <div className="bg-gradient-to-r from-blue/5 to-jade/5 rounded-lg p-4 border border-jade/10">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      questionsData.scoring.overallScore >= 90 ? 'text-green-600' :
                      questionsData.scoring.overallScore >= 70 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {questionsData.scoring.overallScore}%
                    </div>
                    <div className="text-sm text-muted-foreground">Overall Score</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      questionsData.scoring.readinessLevel === 'AUDIT_READY' ? 'text-green-600' :
                      questionsData.scoring.readinessLevel === 'NEEDS_IMPROVEMENT' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {questionsData.scoring.readinessLevel.replace('_', ' ')}
                    </div>
                    <div className="text-sm text-muted-foreground">Readiness Level</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {questionsData.scoring.estimatedAuditSuccess}%
                    </div>
                    <div className="text-sm text-muted-foreground">Audit Success</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      questionsData.scoring.criticalIssuesCount === 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {questionsData.scoring.criticalIssuesCount}
                    </div>
                    <div className="text-sm text-muted-foreground">Critical Issues</div>
                  </div>
                </div>
                
                {questionsData.scoring.topRecommendations && questionsData.scoring.topRecommendations.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-jade/10">
                    <h5 className="font-medium text-jade mb-2">Top Recommendations:</h5>
                    <ul className="text-sm space-y-1">
                      {questionsData.scoring.topRecommendations.slice(0, 3).map((rec: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2">
                          <span className="text-jade">•</span>
                          <span className="text-muted-foreground">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
            {/* Primary Progress Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Overall Progress</span>
                  <span className="font-medium">
                    {questionsData.progress.answeredQuestions} / {questionsData.progress.totalQuestions}
                    <span className="text-jade ml-1">
                      ({Math.round((questionsData.progress.answeredQuestions / questionsData.progress.totalQuestions) * 100)}%)
                    </span>
                  </span>
                </div>
                <Progress 
                  value={(questionsData.progress.answeredQuestions / questionsData.progress.totalQuestions) * 100} 
                  className="h-3"
                />
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Critical Questions</span>
                  <span className="font-medium">
                    {questionsData.progress.answeredRequiredQuestions} / {questionsData.progress.requiredQuestions}
                    <span className="text-jade ml-1">
                      ({Math.round((questionsData.progress.answeredRequiredQuestions / questionsData.progress.requiredQuestions) * 100)}%)
                    </span>
                  </span>
                </div>
                <Progress 
                  value={(questionsData.progress.answeredRequiredQuestions / questionsData.progress.requiredQuestions) * 100} 
                  className="h-3"
                />
              </div>
            </div>

            {/* Smart Insights */}
            <div className="bg-gradient-to-r from-jade/5 to-blue/5 rounded-lg p-4 border border-jade/10">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-jade mt-0.5" />
                <div className="flex-1">
                  <h4 className="font-medium text-jade mb-2">Smart Assessment Insights</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Completion Status:</span>
                      <div className="mt-1">
                        {questionsData.progress.answeredQuestions === questionsData.progress.totalQuestions ? (
                          <Badge className="bg-green-500/10 text-green-600 border-green-200">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Complete
                          </Badge>
                        ) : (questionsData.progress.answeredQuestions / questionsData.progress.totalQuestions) >= 0.8 ? (
                          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200">
                            <Clock className="h-3 w-3 mr-1" />
                            Nearly Complete
                          </Badge>
                        ) : (
                          <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            In Progress
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Estimated Time Remaining:</span>
                      <div className="mt-1 font-medium">
                        {Math.ceil((questionsData.progress.totalQuestions - questionsData.progress.answeredQuestions) * 2.5)} minutes
                      </div>
                    </div>
                  </div>

                  {filteringInfo && (
                    <div className="mt-3 pt-3 border-t border-jade/10">
                      <div className="text-xs text-muted-foreground">
                        🎯 <strong>Smart Filtering Benefit:</strong> You're answering {filteringInfo.filteredQuestionsCount} targeted questions 
                        instead of {filteringInfo.totalAvailableQuestions} generic ones, saving approximately{' '}
                        <strong className="text-jade">
                          {Math.round((1 - filteringInfo.filteringRatio) * filteringInfo.totalAvailableQuestions * 2.5)} minutes
                        </strong> of assessment time.
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardContent className="p-6">
          {questionsData.filtering ? (
            <div>
              <div className="mb-4 p-3 bg-jade/10 border border-jade/20 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm">
                    <span className="inline-block w-2 h-2 bg-jade rounded-full"></span>
                    <span className="font-medium text-jade">Intelligent Filtering Applied</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleRefreshFiltering}
                    disabled={refreshing}
                    className="h-7 px-2 text-xs"
                  >
                    <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Questions filtered based on intake form responses ({(questionsData.filtering.filteringRatio * 100).toFixed(1)}% efficiency)
                </p>
              </div>

              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {questionsData.totalQuestions}
                  </div>
                  <div className="text-sm text-muted-foreground">Filtered Questions</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-muted-foreground">
                    {questionsData.filtering.totalAvailableQuestions}
                  </div>
                  <div className="text-sm text-muted-foreground">Total Available</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-foreground">
                    {questionsData.requiredCount}
                  </div>
                  <div className="text-sm text-muted-foreground">Required</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-jade">
                    {questionsData.filtering.applicableRecCodes?.join(', ') || 'None'}
                  </div>
                  <div className="text-sm text-muted-foreground">REC Categories</div>
                </div>
              </div>
              {questionsData.filtering.scopeStatement && (
                <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                  <h4 className="text-sm font-medium text-foreground mb-2">Assessment Scope</h4>
                  <p className="text-xs text-muted-foreground">{questionsData.filtering.scopeStatement}</p>
                </div>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {questionsData.totalQuestions}
                </div>
                <div className="text-sm text-muted-foreground">Total Questions</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {questionsData.requiredCount}
                </div>
                <div className="text-sm text-muted-foreground">Required</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-foreground">
                  {questionsData.standardCode}
                </div>
                <div className="text-sm text-muted-foreground">Standard</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Question Groups */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-foreground mb-4">Assessment Questions</h3>

          <Accordion type="multiple" className="space-y-2">
            {questionsData.groups.map((group) => (
              <AccordionItem
                key={group.clauseRef}
                value={group.clauseRef}
                data-testid={`clause-${group.clauseRef}`}
              >
                <AccordionTrigger className="text-left">
                  <div className="flex items-center justify-between w-full pr-4">
                    <span className="font-medium">
                      {group.clauseRef}: {group.clauseTitle}
                    </span>
                    <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">
                      {group.questions.length} questions
                    </span>
                  </div>
                </AccordionTrigger>

                <AccordionContent>
                  <div className="space-y-6 pt-4">
                    {group.questions.map((question, _index) => (
                      <div
                        key={question.id}
                        className="border-l-2 border-muted pl-4"
                        data-testid={`q-${question.questionId}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs text-muted-foreground font-mono">
                            {question.questionId}
                          </span>
                          {question.evidenceRequired && (
                            <span className="text-xs text-orange-400 bg-orange-500/10 px-2 py-1 rounded">
                              Evidence Required
                            </span>
                          )}
                        </div>

                        {renderQuestion(question)}

                        {question.category && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Category: {question.category_name || question.category}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}