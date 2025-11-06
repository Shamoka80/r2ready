
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Checkbox } from './ui/checkbox';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Progress } from './ui/progress';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { useToast } from '../hooks/use-toast';
import { 
  Brain, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  ArrowRight, 
  ArrowLeft,
  Filter,
  Zap
} from 'lucide-react';

interface ConditionalQuestion {
  id: string;
  text: string;
  section: string;
  category: string;
  type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'number';
  options?: string[];
  dependencies: any[];
  isVisible: boolean;
  isRequired: boolean;
  facilityTypeSpecific?: string[];
  helpText?: string;
}

interface SmartAssessmentFormProps {
  assessmentId: string;
  facilityProfile: {
    facilityType: string;
    hasDataDestruction: boolean;
    hasRefurbishment: boolean;
    squareFootage: number;
    businessModel: string;
  };
  onAnswerChange?: (questionId: string, value: any) => void;
  onComplete?: (answers: Record<string, any>) => void;
}

export default function SmartAssessmentForm({ 
  assessmentId, 
  facilityProfile, 
  onAnswerChange, 
  onComplete 
}: SmartAssessmentFormProps) {
  const [questions, setQuestions] = useState<ConditionalQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [currentSection, setCurrentSection] = useState<string>('');
  const [sections, setSections] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [progress, setProgress] = useState(0);
  const [smartRecommendations, setSmartRecommendations] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    loadQuestions();
    loadSmartRecommendations();
  }, [assessmentId, facilityProfile]);

  useEffect(() => {
    calculateProgress();
    updateQuestionVisibility();
  }, [answers]);

  const loadQuestions = async () => {
    try {
      setLoading(true);
      
      const response = await fetch('/api/question-dependencies/filtered-questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filter: facilityProfile,
          assessmentId
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setQuestions(data.questions);
        
        // Extract unique sections
        const uniqueSections = [...new Set(data.questions.map((q: ConditionalQuestion) => q.section))] as string[];
        setSections(uniqueSections);
        setCurrentSection(uniqueSections[0] as string || '');
        
        toast({
          title: "Smart Questions Loaded",
          description: `${data.visibleQuestions} relevant questions identified for your facility type`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error loading questions:', error);
      toast({
        title: "Error",
        description: "Failed to load smart questions",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadSmartRecommendations = async () => {
    try {
      const queryParams = new URLSearchParams(facilityProfile as any).toString();
      const response = await fetch(`/api/question-dependencies/recommendations/${assessmentId}?${queryParams}`);
      const data = await response.json();
      
      if (data.success) {
        setSmartRecommendations(data.recommendations);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  };

  const updateQuestionVisibility = async () => {
    try {
      const changedAnswers = Object.entries(answers).map(([questionId, value]) => ({
        questionId,
        value
      }));

      if (changedAnswers.length === 0) return;

      const response = await fetch('/api/question-dependencies/update-visibility', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assessmentId,
          changedAnswers
        }),
      });

      const data = await response.json();
      
      if (data.success && data.changes) {
        // Handle visibility changes
        if (data.changes.newlyVisible.length > 0) {
          toast({
            title: "New Questions Available",
            description: `${data.changes.newlyVisible.length} additional questions are now relevant`
          });
        }
      }
    } catch (error) {
      console.error('Error updating question visibility:', error);
    }
  };

  const calculateProgress = () => {
    const visibleQuestions = questions.filter(q => q.isVisible);
    const answeredQuestions = visibleQuestions.filter(q => answers[q.id] !== undefined && answers[q.id] !== '');
    const progressPercentage = visibleQuestions.length > 0 ? (answeredQuestions.length / visibleQuestions.length) * 100 : 0;
    setProgress(Math.round(progressPercentage));
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));

    onAnswerChange?.(questionId, value);
  };

  const validateSection = (section: string): boolean => {
    const sectionQuestions = questions.filter(q => q.section === section && q.isVisible && q.isRequired);
    const errors: string[] = [];

    sectionQuestions.forEach(question => {
      const answer = answers[question.id];
      if (!answer || answer === '') {
        errors.push(`${question.text} is required`);
      }
    });

    setValidationErrors(errors);
    return errors.length === 0;
  };

  const nextSection = () => {
    const currentIndex = sections.indexOf(currentSection);
    if (validateSection(currentSection) && currentIndex < sections.length - 1) {
      setCurrentSection(sections[currentIndex + 1] as string);
    }
  };

  const prevSection = () => {
    const currentIndex = sections.indexOf(currentSection);
    if (currentIndex > 0) {
      setCurrentSection(sections[currentIndex - 1] as string);
    }
  };

  const renderQuestion = (question: ConditionalQuestion) => {
    if (!question.isVisible) return null;

    const answer = answers[question.id] || '';

    return (
      <Card key={question.id} className={`transition-all duration-200 ${question.isRequired ? 'border-blue-200' : 'border-gray-200'}`}>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <Label className="text-base font-medium">
                  {question.text}
                  {question.isRequired && <span className="text-red-500 ml-1">*</span>}
                </Label>
                {question.helpText && (
                  <p className="text-sm text-muted-foreground mt-1">{question.helpText}</p>
                )}
              </div>
              
              <div className="flex gap-2 ml-4">
                {question.facilityTypeSpecific && (
                  <Badge variant="secondary" className="text-xs">
                    {facilityProfile.facilityType}
                  </Badge>
                )}
                {question.isRequired && (
                  <Badge variant="destructive" className="text-xs">
                    Required
                  </Badge>
                )}
              </div>
            </div>

            {renderQuestionInput(question, answer)}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderQuestionInput = (question: ConditionalQuestion, answer: any) => {
    switch (question.type) {
      case 'text':
        return (
          <Input
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter your answer..."
          />
        );

      case 'textarea':
        return (
          <Textarea
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, e.target.value)}
            placeholder="Enter detailed answer..."
            rows={3}
          />
        );

      case 'select':
        return (
          <Select value={answer} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            <SelectTrigger>
              <SelectValue placeholder="Select an option..." />
            </SelectTrigger>
            <SelectContent>
              {question.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'radio':
        return (
          <RadioGroup value={answer} onValueChange={(value) => handleAnswerChange(question.id, value)}>
            {question.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </RadioGroup>
        );

      case 'checkbox':
        return (
          <div className="space-y-2">
            {question.options?.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <Checkbox
                  id={`${question.id}-${option}`}
                  checked={Array.isArray(answer) ? answer.includes(option) : false}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      handleAnswerChange(question.id, [...(Array.isArray(answer) ? answer : []), option]);
                    } else {
                      handleAnswerChange(question.id, Array.isArray(answer) ? answer.filter(a => a !== option) : []);
                    }
                  }}
                />
                <Label htmlFor={`${question.id}-${option}`}>{option}</Label>
              </div>
            ))}
          </div>
        );

      case 'number':
        return (
          <Input
            type="number"
            value={answer}
            onChange={(e) => handleAnswerChange(question.id, parseInt(e.target.value) || '')}
            placeholder="Enter number..."
          />
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <Brain className="w-6 h-6 animate-pulse text-blue-600" />
              <span>Loading smart questions for your facility...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const currentSectionQuestions = questions.filter(q => q.section === currentSection && q.isVisible);
  const currentIndex = sections.indexOf(currentSection);

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Brain className="w-6 h-6 text-blue-600" />
                Smart Assessment Form
              </CardTitle>
              <CardDescription>
                Intelligent question flow optimized for {facilityProfile.facilityType} facilities
              </CardDescription>
            </div>
            <Badge variant="secondary" className="px-3 py-1">
              Phase 4: Enhanced UX
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                Section {currentIndex + 1} of {sections.length}: {currentSection}
              </span>
              <span className="text-sm text-muted-foreground">{progress}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </CardHeader>
      </Card>

      {smartRecommendations && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-600" />
              Smart Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {smartRecommendations.priorityQuestions?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Priority Questions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {smartRecommendations.facilitySpecificQuestions?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Facility-Specific</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {smartRecommendations.optionalQuestions?.length || 0}
                </div>
                <div className="text-sm text-muted-foreground">Optional Questions</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {validationErrors.length > 0 && (
        <Alert variant="destructive" className="mb-6">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Please complete the following required fields:
            <ul className="list-disc list-inside mt-2">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="space-y-4 mb-6">
        {currentSectionQuestions.map(renderQuestion)}
      </div>

      <div className="flex justify-between">
        <Button 
          variant="outline" 
          onClick={prevSection}
          disabled={currentIndex === 0}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Previous Section
        </Button>
        
        <div className="flex gap-2">
          {currentIndex < sections.length - 1 ? (
            <Button 
              onClick={nextSection}
              disabled={validationErrors.length > 0}
            >
              Next Section
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={() => onComplete?.(answers)}
              disabled={validationErrors.length > 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Assessment
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
