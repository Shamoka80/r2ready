
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Download, FileText, FileSpreadsheet, File, Building, Users, Calendar } from 'lucide-react';
import { useToast } from '../hooks/use-toast';

interface ExportTemplate {
  id: string;
  name: string;
  type: 'pdf' | 'excel' | 'word' | 'scope-statement';
  template: string;
  description: string;
}

interface DocumentLibraryItem {
  id: string;
  name: string;
  category: string;
  type: string;
  description: string;
  downloadUrl: string;
  industrySpecific?: string[];
  autoUpdateEnabled?: boolean;
  version?: string;
  lastUpdated?: string;
}

export default function ExportCenter() {
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [documents, setDocuments] = useState<DocumentLibraryItem[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<DocumentLibraryItem[]>([]);
  const [selectedAssessment, setSelectedAssessment] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedIndustry, setSelectedIndustry] = useState<string>('all');
  const [includeEvidence, setIncludeEvidence] = useState(false);
  const [includeAnalytics, setIncludeAnalytics] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [documentStats, setDocumentStats] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
    fetchDocumentLibrary();
  }, []);

  const fetchTemplates = async () => {
    try {
      const response = await fetch('/api/exports/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast({
        title: "Error",
        description: "Failed to load export templates",
        variant: "destructive"
      });
    }
  };

  const fetchDocumentLibrary = async () => {
    try {
      const params = new URLSearchParams();
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (selectedIndustry !== 'all') params.append('industry', selectedIndustry);
      
      const response = await fetch(`/api/exports/document-library?${params}`);
      const data = await response.json();
      if (data.success) {
        setDocuments(data.documents);
        setFilteredDocuments(data.documents);
        setDocumentStats(data.statistics);
      }
    } catch (error) {
      console.error('Error fetching document library:', error);
      toast({
        title: "Error", 
        description: "Failed to load document library",
        variant: "destructive"
      });
    }
  };

  const refreshDocumentLibrary = async () => {
    setIsRefreshing(true);
    await fetchDocumentLibrary();
    setIsRefreshing(false);
    toast({
      title: "Success",
      description: "Document library refreshed"
    });
  };

  const customizeDocument = async (documentId: string) => {
    try {
      // This would open a customization dialog
      // For now, we'll simulate the customization
      const customizations = {
        organizationName: "Sample Organization",
        facilityLocation: "Sample Location",
        certificationScope: "Electronics Processing"
      };

      const response = await fetch('/api/exports/document-library/customize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          templateId: documentId,
          customizations
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Customized document generated"
        });
        
        // Trigger download
        if (data.downloadUrl) {
          window.open(data.downloadUrl, '_blank');
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Document customization error:', error);
      toast({
        title: "Error",
        description: "Failed to customize document",
        variant: "destructive"
      });
    }
  };

  // Filter documents when category or industry changes
  useEffect(() => {
    let filtered = documents;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(doc => doc.category === selectedCategory);
    }
    
    if (selectedIndustry !== 'all') {
      filtered = filtered.filter(doc => 
        !doc.industrySpecific || doc.industrySpecific.includes(selectedIndustry)
      );
    }
    
    setFilteredDocuments(filtered);
  }, [documents, selectedCategory, selectedIndustry]);

  const generateExport = async () => {
    if (!selectedAssessment || !selectedTemplate) {
      toast({
        title: "Error",
        description: "Please select both an assessment and template",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    
    try {
      const template = templates.find(t => t.id === selectedTemplate);
      const response = await fetch('/api/exports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          assessmentId: selectedAssessment,
          templateId: selectedTemplate,
          format: template?.type === 'excel' ? 'xlsx' : template?.type === 'word' ? 'docx' : 'pdf',
          includeEvidence,
          includeAnalytics
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: "Export generated successfully"
        });
        
        // Trigger download
        if (data.downloadUrl) {
          window.open(data.downloadUrl, '_blank');
        }
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error('Export generation error:', error);
      toast({
        title: "Error",
        description: "Failed to generate export",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadDocument = async (documentId: string) => {
    try {
      const response = await fetch(`/api/exports/documents/${documentId}`);
      const data = await response.json();
      
      if (data.success) {
        toast({
          title: "Success",
          description: `${data.fileName} download initiated`
        });
      }
    } catch (error) {
      console.error('Document download error:', error);
      toast({
        title: "Error",
        description: "Failed to download document",
        variant: "destructive"
      });
    }
  };

  const getTemplateIcon = (type: string) => {
    switch (type) {
      case 'pdf': return <FileText className="w-4 h-4" />;
      case 'excel': return <FileSpreadsheet className="w-4 h-4" />;
      case 'word': return <File className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  const getDocumentIcon = (type: string) => {
    switch (type) {
      case 'xlsx': return <FileSpreadsheet className="w-4 h-4" />;
      case 'docx': return <File className="w-4 h-4" />;
      default: return <FileText className="w-4 h-4" />;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Export Center</h1>
          <p className="text-muted-foreground">Generate professional reports and access document templates</p>
        </div>
        <Badge variant="secondary" className="px-3 py-1">
          Phase 3: Export & Reporting
        </Badge>
      </div>

      <Tabs defaultValue="exports" className="space-y-6">
        <TabsList>
          <TabsTrigger value="exports">Report Generator</TabsTrigger>
          <TabsTrigger value="library">Document Library</TabsTrigger>
          <TabsTrigger value="scope">Scope Statement</TabsTrigger>
        </TabsList>

        <TabsContent value="exports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="w-5 h-5" />
                Generate Assessment Report
              </CardTitle>
              <CardDescription>
                Create professional reports from your R2v3 assessments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium">Assessment</label>
                    <Select value={selectedAssessment} onValueChange={setSelectedAssessment}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select assessment" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo-assessment-1">Demo Facility Assessment</SelectItem>
                        <SelectItem value="demo-assessment-2">Electronics Processing Assessment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="text-sm font-medium">Export Template</label>
                    <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select template" />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            <div className="flex items-center gap-2">
                              {getTemplateIcon(template.type)}
                              {template.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <label className="text-sm font-medium">Include Additional Data</label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="evidence"
                          checked={includeEvidence}
                          onCheckedChange={(checked) => setIncludeEvidence(checked === true)}
                        />
                        <label htmlFor="evidence" className="text-sm">Include evidence attachments</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="analytics"
                          checked={includeAnalytics}
                          onCheckedChange={(checked) => setIncludeAnalytics(checked === true)}
                        />
                        <label htmlFor="analytics" className="text-sm">Include detailed analytics</label>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-medium">Available Templates</h3>
                  <div className="space-y-2">
                    {templates.map((template) => (
                      <div key={template.id} className="p-3 border rounded-lg">
                        <div className="flex items-center gap-2 mb-1">
                          {getTemplateIcon(template.type)}
                          <span className="font-medium">{template.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {template.type.toUpperCase()}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">{template.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button 
                onClick={generateExport} 
                disabled={isGenerating || !selectedAssessment || !selectedTemplate}
                className="w-full"
              >
                {isGenerating ? 'Generating...' : 'Generate Export'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="library" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                R2v3 Compliance Document Library
              </CardTitle>
              <CardDescription>
                Professional templates, policies, and procedures aligned with R2v3 Core Requirements and Appendices
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Library Filters */}
              <div className="flex gap-4 flex-wrap">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="policies">Governance & Policies</SelectItem>
                    <SelectItem value="procedures">Operating Procedures</SelectItem>
                    <SelectItem value="forms">Forms & Records</SelectItem>
                    <SelectItem value="checklists">Audit & Checklists</SelectItem>
                    <SelectItem value="training">Training & Competency</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={selectedIndustry} onValueChange={setSelectedIndustry}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Industries</SelectItem>
                    <SelectItem value="electronics">Electronics Recycling</SelectItem>
                    <SelectItem value="recycling">R2v3 Facilities</SelectItem>
                    <SelectItem value="it-services">IT Asset Disposition</SelectItem>
                    <SelectItem value="general">General Compliance</SelectItem>
                  </SelectContent>
                </Select>

                <Button 
                  variant="outline" 
                  onClick={refreshDocumentLibrary}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? 'Refreshing...' : 'Refresh Library'}
                </Button>
              </div>

              {/* Library Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">{documentStats?.totalTemplates || 0}</div>
                  <div className="text-sm text-muted-foreground">Total Templates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{documentStats?.recentUpdates || 0}</div>
                  <div className="text-sm text-muted-foreground">Recent Updates</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">{documentStats?.autoUpdateEnabled || 0}</div>
                  <div className="text-sm text-muted-foreground">Auto-Update Enabled</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">{filteredDocuments.length}</div>
                  <div className="text-sm text-muted-foreground">Filtered Results</div>
                </div>
              </div>

              {/* Document Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredDocuments.map((doc) => (
                  <Card key={doc.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {getDocumentIcon(doc.type)}
                          <Badge variant="outline" className="text-xs">
                            {doc.category}
                          </Badge>
                          {doc.autoUpdateEnabled && (
                            <Badge variant="secondary" className="text-xs">
                              Auto-Update
                            </Badge>
                          )}
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => customizeDocument(doc.id)}
                            title="Customize document"
                          >
                            <Users className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadDocument(doc.id)}
                            title="Download template"
                          >
                            <Download className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                      <h4 className="font-medium mb-1">{doc.name}</h4>
                      <p className="text-sm text-muted-foreground mb-2">{doc.description}</p>
                      <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>v{doc.version}</span>
                        <span>{doc.lastUpdated ? new Date(doc.lastUpdated).toLocaleDateString() : 'N/A'}</span>
                      </div>
                      {doc.industrySpecific && (
                        <div className="mt-2">
                          <div className="flex gap-1 flex-wrap">
                            {doc.industrySpecific.map((industry) => (
                              <Badge key={industry} variant="outline" className="text-xs">
                                {industry}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="scope" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Scope Statement Generator
              </CardTitle>
              <CardDescription>
                Generate R2v3 scope statements for certification bodies
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-medium mb-2">Scope Statement Features</h4>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  <li>• Automatic facility activity extraction</li>
                  <li>• Materials and processes identification</li>
                  <li>• Compliance scope definition</li>
                  <li>• Professional formatting for certification bodies</li>
                </ul>
              </div>
              
              <Button className="w-full" variant="outline">
                Generate Scope Statement
                <FileText className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
