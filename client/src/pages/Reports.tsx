import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  FileText, 
  Download, 
  Eye, 
  Share2, 
  Filter, 
  Search,
  Calendar,
  Building2,
  MoreHorizontal,
  FileSpreadsheet,
  Mail
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet } from '@/api';
import { format } from 'date-fns';

// Helper function to download a file
const downloadFile = async (url: string, filename: string) => {
  try {
    // Get token from localStorage (same as apiGet)
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      console.error('❌ No auth token found in localStorage. Keys:', Object.keys(localStorage));
      throw new Error('No authentication token found. Please log in again.');
    }
    
    console.log('✅ Auth token found, length:', token.length);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    // Build full URL
    const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
    const fullUrl = `${apiBase}${url}`;

    console.log('Downloading report from:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      credentials: 'include', // Include cookies if any
    });

    if (!response.ok) {
      let errorMessage = `Download failed: ${response.status} ${response.statusText}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              // Not JSON, use the text as is
              if (errorText.length < 200) errorMessage = errorText;
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      console.error('Download failed:', response.status, errorMessage);
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  } catch (error) {
    console.error('Download error:', error);
    alert(`Failed to download report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Helper function to view a file in a new tab
const viewFile = async (url: string) => {
  try {
    const token = localStorage.getItem('auth_token');
    
    if (!token) {
      console.error('❌ No auth token found in localStorage. Keys:', Object.keys(localStorage));
      throw new Error('No authentication token found. Please log in again.');
    }
    
    console.log('✅ Auth token found for viewing, length:', token.length);

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
    };

    const apiBase = typeof window !== 'undefined' && window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : '';
    const fullUrl = `${apiBase}${url}`;

    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = `Failed to open report: ${response.status} ${response.statusText}`;
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText) {
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorJson.error || errorMessage;
            } catch {
              // Not JSON, use the text as is
              if (errorText.length < 200) errorMessage = errorText;
            }
          }
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError);
      }
      console.error('View failed:', response.status, errorMessage);
      throw new Error(errorMessage);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const newWindow = window.open(blobUrl, '_blank');
    
    if (!newWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups and try again.');
    }

    // Clean up blob URL after a delay (file should be loaded by then)
    setTimeout(() => window.URL.revokeObjectURL(blobUrl), 1000);
  } catch (error) {
    console.error('View error:', error);
    alert(`Failed to open report: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

interface Report {
  id: string;
  name: string;
  type: 'PDF' | 'Excel' | 'Word' | 'Email';
  assessmentId: string;
  assessmentTitle: string;
  facilityName?: string;
  createdAt: string;
  createdBy: string;
  fileSize?: number;
  version: number;
  downloadUrl?: string;
}

export default function Reports() {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // Fetch reports
  const { data: reports = [], isLoading } = useQuery<Report[]>({
    queryKey: ['reports'],
    queryFn: async () => {
      return await apiGet<Report[]>('/api/reports');
    },
    retry: 2,
  });

  const filteredReports = reports.filter(report => {
    const matchesSearch = 
      report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.assessmentTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      report.facilityName?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'PDF':
        return <FileText className="h-4 w-4 text-red-600" />;
      case 'Excel':
        return <FileSpreadsheet className="h-4 w-4 text-green-600" />;
      case 'Word':
        return <FileText className="h-4 w-4 text-blue-600" />;
      case 'Email':
        return <Mail className="h-4 w-4 text-purple-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline' | 'destructive'> = {
      'PDF': 'destructive',
      'Excel': 'default',
      'Word': 'secondary',
      'Email': 'outline',
    };
    return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'N/A';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Reports & Documents</h1>
          <p className="text-muted-foreground mt-1">
            Access and manage all generated reports
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">PDF Reports</CardTitle>
            <FileText className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.type === 'PDF').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Excel Reports</CardTitle>
            <FileSpreadsheet className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => r.type === 'Excel').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">This Month</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {reports.filter(r => {
                const createdDate = new Date(r.createdAt);
                const now = new Date();
                return createdDate.getMonth() === now.getMonth() && 
                       createdDate.getFullYear() === now.getFullYear();
              }).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filter Reports</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, assessment, or facility..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
                data-testid="input-search-reports"
              />
            </div>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-48" data-testid="select-filter-type">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="PDF">PDF Only</SelectItem>
                <SelectItem value="Excel">Excel Only</SelectItem>
                <SelectItem value="Word">Word Only</SelectItem>
                <SelectItem value="Email">Email Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Reports Table */}
      <Card data-testid="reports-table">
        <CardHeader>
          <CardTitle>All Reports</CardTitle>
          <CardDescription>
            {filteredReports.length} report{filteredReports.length !== 1 ? 's' : ''} found
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">Loading reports...</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                {searchQuery || typeFilter !== 'all' 
                  ? 'No reports match your filters' 
                  : 'No reports generated yet'}
              </p>
              {searchQuery || typeFilter !== 'all' ? (
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setSearchQuery('');
                    setTypeFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              ) : null}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Report Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Assessment</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Version</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredReports.map((report) => (
                  <TableRow key={report.id} data-testid={`report-row-${report.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getTypeIcon(report.type)}
                        <span className="font-medium">{report.name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{getTypeBadge(report.type)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {report.assessmentTitle}
                    </TableCell>
                    <TableCell>
                      {report.facilityName ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-muted-foreground" />
                          <span className="text-sm">{report.facilityName}</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(report.createdAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">v{report.version}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatFileSize(report.fileSize)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${report.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={async () => {
                              if (report.downloadUrl) {
                                await downloadFile(report.downloadUrl, report.name);
                              }
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={async () => {
                              if (report.downloadUrl) {
                                await viewFile(report.downloadUrl);
                              }
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Share2 className="h-4 w-4 mr-2" />
                            Share (Coming Soon)
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <Mail className="h-4 w-4 mr-2" />
                            Email (Coming Soon)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Export Guide */}
      <Card>
        <CardHeader>
          <CardTitle>Export Options</CardTitle>
          <CardDescription>Available report formats</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <p className="font-medium">PDF Reports</p>
              <p className="text-sm text-muted-foreground">
                Professional certification reports with charts and analysis
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <FileSpreadsheet className="h-5 w-5 text-green-600 mt-0.5" />
            <div>
              <p className="font-medium">Excel Reports</p>
              <p className="text-sm text-muted-foreground">
                Detailed data exports for further analysis and tracking
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <FileText className="h-5 w-5 text-blue-600 mt-0.5" />
            <div>
              <p className="font-medium">Word Documents</p>
              <p className="text-sm text-muted-foreground">
                Editable reports for customization and internal review
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
            <Mail className="h-5 w-5 text-purple-600 mt-0.5" />
            <div>
              <p className="font-medium">Email Summaries</p>
              <p className="text-sm text-muted-foreground">
                Quick summaries sent directly to stakeholders
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
