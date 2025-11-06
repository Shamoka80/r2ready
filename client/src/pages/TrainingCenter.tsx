
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { useFeatureFlag } from '../lib/flags';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  BookOpen, 
  Award, 
  Clock, 
  Users, 
  CheckCircle, 
  Play, 
  Search,
  Download,
  Brain,
  Target,
  TrendingUp,
  Star,
  AlertTriangle
} from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface TrainingModule {
  id: string;
  title: string;
  description: string;
  category: string;
  r2v3Clause: string;
  estimatedDuration: number;
  difficulty: string;
  prerequisites: string[];
  learningObjectives: string[];
  isRequired: boolean;
  certificationWeight: number;
}

interface UserProgress {
  moduleId: string;
  status: string;
  progress: number;
  timeSpent: number;
  lastAccessed: Date;
  assessmentScores: Record<string, number>;
  certificationDate?: Date;
}

export default function TrainingCenter() {
  const isTrainingCenterEnabled = useFeatureFlag('training_center');
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [userProgress, setUserProgress] = useState<Record<string, UserProgress>>({});
  const [certificationPrep, setCertificationPrep] = useState<any>(null);
  const [knowledgeBase, setKnowledgeBase] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { toast } = useToast();

  if (!isTrainingCenterEnabled) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Training Center</CardTitle>
            <CardDescription>Feature Not Available</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              The Training Center feature is currently disabled. Contact your administrator to enable this feature.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  useEffect(() => {
    loadTrainingData();
    loadCertificationPrep();
    loadKnowledgeBase();
  }, []);

  const loadTrainingData = async () => {
    try {
      const response = await fetch('/api/training-center/modules');
      const data = await response.json();
      
      if (data.success) {
        setModules(data.modules || []);
        setUserProgress(data.userProgress || {});
      } else {
        throw new Error(data.error || 'Failed to load training data');
      }
    } catch (error) {
      console.error('Error loading training data:', error);
      toast({
        title: "Error",
        description: "Failed to load training modules",
        variant: "destructive"
      });
    }
  };

  const loadCertificationPrep = async () => {
    try {
      const response = await fetch('/api/training-center/certification-prep');
      const data = await response.json();
      
      if (data.success) {
        setCertificationPrep(data);
      }
    } catch (error) {
      console.error('Error loading certification prep:', error);
    }
  };

  const loadKnowledgeBase = async () => {
    try {
      const response = await fetch('/api/training-center/knowledge-base');
      const data = await response.json();
      
      if (data.success) {
        setKnowledgeBase(data.articles);
      }
    } catch (error) {
      console.error('Error loading knowledge base:', error);
    } finally {
      setLoading(false);
    }
  };

  const startModule = async (moduleId: string) => {
    try {
      const response = await fetch(`/api/training-center/modules/${moduleId}/start`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Module Started",
          description: "You can now begin your training"
        });
        
        // Update progress state
        setUserProgress(prev => ({
          ...prev,
          [moduleId]: data.progress
        }));
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error starting module:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start module",
        variant: "destructive"
      });
    }
  };

  const downloadCertificate = async (moduleId: string) => {
    try {
      const response = await fetch(`/api/training-center/modules/${moduleId}/certificate`, {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        window.open(data.downloadUrl, '_blank');
        toast({
          title: "Certificate Generated",
          description: "Your certificate is ready for download"
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Error generating certificate:', error);
      toast({
        title: "Error",
        description: "Failed to generate certificate",
        variant: "destructive"
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'certified':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <Play className="w-5 h-5 text-blue-600" />;
      default:
        return <BookOpen className="w-5 h-5 text-muted-foreground" />;
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'beginner':
        return 'bg-green-500/20 text-green-400';
      case 'intermediate':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'advanced':
        return 'bg-red-500/20 text-red-400';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const filteredModules = modules.filter(module => {
    const matchesSearch = module.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         module.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || module.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Brain className="w-12 h-12 animate-pulse text-blue-600 mx-auto mb-4" />
            <p>Loading training center...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Training Center</h1>
          <p className="text-muted-foreground">Master R2v3 compliance with interactive learning modules</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          Phase 5: Enterprise Features
        </Badge>
      </div>

      <Tabs defaultValue="modules" className="space-y-6">
        <TabsList>
          <TabsTrigger value="modules">Training Modules</TabsTrigger>
          <TabsTrigger value="interactive">Interactive Tutorials</TabsTrigger>
          <TabsTrigger value="knowledge">Knowledge Base</TabsTrigger>
          <TabsTrigger value="certification">Certification Prep</TabsTrigger>
          <TabsTrigger value="glossary">R2v3 Glossary</TabsTrigger>
        </TabsList>

        <TabsContent value="modules" className="space-y-6">
          {/* Overview Cards */}
          <div className="grid md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <BookOpen className="w-8 h-8 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold">{modules.length}</p>
                    <p className="text-sm text-muted-foreground">Training Modules</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Core Requirements & Appendices
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Object.values(userProgress).filter(p => p.status === 'completed' || p.status === 'certified').length}
                    </p>
                    <p className="text-sm text-muted-foreground">Completed</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {Math.round((Object.values(userProgress).filter(p => p.status === 'completed' || p.status === 'certified').length / Math.max(modules.length, 1)) * 100)}% Progress
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Clock className="w-8 h-8 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Math.round(Object.values(userProgress).reduce((sum, p) => sum + (p.timeSpent || 0), 0) / 60) || 0}h
                    </p>
                    <p className="text-sm text-muted-foreground">Learning Time</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Industry-leading curriculum
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Award className="w-8 h-8 text-purple-600" />
                  <div>
                    <p className="text-2xl font-bold">
                      {Object.values(userProgress).filter(p => p.certificationDate).length || 0}
                    </p>
                    <p className="text-sm text-muted-foreground">Certificates</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      R2v3 Compliance Ready
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* R2v3 Preparation Progress */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                R2v3 Certification Preparation Progress
              </CardTitle>
              <CardDescription>
                180-day comprehensive preparation program for R2v3 certification success
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Phase 1: Foundation Building</span>
                    <span className="text-green-600 font-medium">Completed</span>
                  </div>
                  <Progress value={100} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Phase 2: System Implementation</span>
                    <span className="text-blue-600 font-medium">In Progress (65%)</span>
                  </div>
                  <Progress value={65} className="h-2" />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Phase 3: Audit Preparation</span>
                    <span className="text-muted-foreground">Pending</span>
                  </div>
                  <Progress value={0} className="h-2" />
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <div className="text-sm text-muted-foreground">
                  Overall Certification Readiness
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600">68%</div>
                  <div className="text-sm text-muted-foreground">Est. 42 days remaining</div>
                </div>
              </div>
              <Progress value={68} className="h-3" />
            </CardContent>
          </Card>

          {/* Filters */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search training modules..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="core_requirements">Core Requirements</SelectItem>
                    <SelectItem value="process_requirements">Process Requirements</SelectItem>
                    <SelectItem value="appendices">Appendices</SelectItem>
                    <SelectItem value="implementation">Implementation</SelectItem>
                    <SelectItem value="audit_prep">Audit Preparation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Training Modules */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModules.map((module) => {
              const progress = userProgress[module.id];
              const isCompleted = progress?.status === 'completed' || progress?.status === 'certified';
              const isInProgress = progress?.status === 'in_progress';
              
              return (
                <Card key={module.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{module.title}</CardTitle>
                        <CardDescription className="mt-2">{module.description}</CardDescription>
                      </div>
                      {getStatusIcon(progress?.status || 'not_started')}
                    </div>
                    
                    <div className="flex gap-2 mt-4">
                      <Badge variant="outline" className="text-xs">
                        {module.r2v3Clause}
                      </Badge>
                      <Badge className={`text-xs ${getDifficultyColor(module.difficulty)}`}>
                        {module.difficulty}
                      </Badge>
                      {module.isRequired && (
                        <Badge variant="destructive" className="text-xs">
                          Required
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {module.estimatedDuration} min
                      </span>
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {module.certificationWeight}% weight
                      </span>
                    </div>

                    {progress && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Progress</span>
                          <span>{progress.progress}%</span>
                        </div>
                        <Progress value={progress.progress} className="h-2" />
                      </div>
                    )}

                    <div className="flex gap-2">
                      {!progress || progress.status === 'not_started' ? (
                        <Button 
                          onClick={() => startModule(module.id)}
                          className="flex-1"
                          size="sm"
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Start Module
                        </Button>
                      ) : isInProgress ? (
                        <Button 
                          onClick={() => startModule(module.id)}
                          variant="outline"
                          className="flex-1"
                          size="sm"
                        >
                          Continue
                        </Button>
                      ) : (
                        <Button 
                          onClick={() => startModule(module.id)}
                          variant="outline"
                          className="flex-1"
                          size="sm"
                        >
                          Review
                        </Button>
                      )}
                      
                      {isCompleted && (
                        <Button 
                          onClick={() => downloadCertificate(module.id)}
                          size="sm"
                          variant="secondary"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Certificate
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="knowledge" className="space-y-6">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {knowledgeBase.map((article) => (
              <Card key={article.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <CardTitle className="text-lg">{article.title}</CardTitle>
                  <CardDescription>{article.content.substring(0, 150)}...</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <Badge variant="outline">{article.category}</Badge>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {article.readTime} min read
                    </span>
                  </div>
                  
                  <div className="flex gap-2 mb-4">
                    {article.tags.map((tag: string) => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  
                  <Button variant="outline" size="sm" className="w-full">
                    Read Article
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="certification" className="space-y-6">
          {certificationPrep && (
            <>
              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-blue-600" />
                      Overall Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Modules Completed</span>
                        <span>{certificationPrep.completedModules}/{certificationPrep.totalModules}</span>
                      </div>
                      <Progress value={certificationPrep.overallProgress} className="h-3" />
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span>Readiness Score</span>
                        <span className="font-bold text-blue-600">{certificationPrep.readinessScore}%</span>
                      </div>
                      <Progress value={certificationPrep.readinessScore} className="h-3" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-6 h-6 text-green-600" />
                      Time to Ready
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-center space-y-2">
                      <div className="text-3xl font-bold text-green-600">
                        {certificationPrep.estimatedTimeToReady}h
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Estimated time to certification readiness
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Next Steps</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {certificationPrep.nextSteps.map((step: string, index: number) => (
                        <li key={index} className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-600" />
                          <span className="text-sm">{step}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Recommendations</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {certificationPrep.recommendations.map((rec: string, index: number) => (
                        <li key={index} className="flex items-center gap-2">
                          <Star className="w-4 h-4 text-yellow-600" />
                          <span className="text-sm">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="interactive" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Interactive R2v3 Tutorials</CardTitle>
              <CardDescription>
                Hands-on learning with simulations and interactive exercises
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-600" />
                      Scope Determination Simulator
                    </CardTitle>
                    <CardDescription>
                      Interactive tool to practice determining R2v3 certification scope
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>75%</span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">Continue</Button>
                        <Button size="sm" variant="outline">Reset</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="w-5 h-5 text-purple-600" />
                      Data Sanitization Lab
                    </CardTitle>
                    <CardDescription>
                      Virtual lab for practicing data destruction procedures
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>40%</span>
                      </div>
                      <Progress value={40} className="h-2" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">Start Lab</Button>
                        <Button size="sm" variant="outline">Info</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Vendor Assessment Tool
                    </CardTitle>
                    <CardDescription>
                      Practice downstream vendor due diligence procedures
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>0%</span>
                      </div>
                      <Progress value={0} className="h-2" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">Begin</Button>
                        <Button size="sm" variant="outline">Preview</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                      Incident Response Simulator
                    </CardTitle>
                    <CardDescription>
                      Practice handling compliance incidents and corrective actions
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span>Progress</span>
                        <span>0%</span>
                      </div>
                      <Progress value={0} className="h-2" />
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1">Launch</Button>
                        <Button size="sm" variant="outline">Guide</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Learning Achievements</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Star className="w-8 h-8 text-yellow-500" />
                  <div>
                    <h4 className="font-medium">First Steps</h4>
                    <p className="text-sm text-muted-foreground">Completed first training module</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg">
                  <Brain className="w-8 h-8 text-purple-500" />
                  <div>
                    <h4 className="font-medium">Knowledge Seeker</h4>
                    <p className="text-sm text-muted-foreground">Read 5 knowledge base articles</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-lg opacity-50">
                  <Award className="w-8 h-8 text-muted-foreground" />
                  <div>
                    <h4 className="font-medium">Expert Level</h4>
                    <p className="text-sm text-muted-foreground">Complete all core modules</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="glossary" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>R2v3 Terminology Glossary</CardTitle>
              <CardDescription>
                Essential terms and definitions for R2v3 compliance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Glossary items would be loaded dynamically */}
                <div className="border-l-4 border-blue-500 pl-4">
                  <h4 className="font-semibold">R2v3 Standard</h4>
                  <p className="text-sm text-muted-foreground">
                    Responsible Recycling Standard version 3, the leading global standard for electronics recycling and data destruction.
                  </p>
                </div>
                <div className="border-l-4 border-green-500 pl-4">
                  <h4 className="font-semibold">Focus Materials</h4>
                  <p className="text-sm text-muted-foreground">
                    Electronic equipment and components that are subject to R2 requirements, as defined in Appendix A.
                  </p>
                </div>
                <div className="border-l-4 border-purple-500 pl-4">
                  <h4 className="font-semibold">Data Sanitization</h4>
                  <p className="text-sm text-muted-foreground">
                    The process of deliberately, permanently, and irreversibly removing or destroying data stored on a memory device.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
