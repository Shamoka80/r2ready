
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Upload, Download, Cloud, HardDrive, CheckCircle, XCircle } from 'lucide-react';

interface CloudProvider {
  id: string;
  name: string;
  type: string;
  credentials: boolean;
  quotaUsed: number;
  quotaLimit: number;
  isActive: boolean;
}

interface QuotaInfo {
  used: number;
  limit: number;
  available: number;
  usagePercentage: number;
}

export default function CloudStorageManager() {
  const [providers, setProviders] = useState<CloudProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [selectedProviders, setSelectedProviders] = useState<string[]>([]);

  useEffect(() => {
    fetchProviders();
  }, []);

  const fetchProviders = async () => {
    try {
      const response = await fetch('/api/cloud-storage-integration/providers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setProviders(data.providers);
      }
    } catch (error) {
      console.error('Failed to fetch providers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
  };

  const handleProviderToggle = (providerId: string) => {
    setSelectedProviders(prev => 
      prev.includes(providerId) 
        ? prev.filter(id => id !== providerId)
        : [...prev, providerId]
    );
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedProviders.length === 0) {
      alert('Please select files and at least one provider');
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      Array.from(selectedFiles).forEach(file => {
        formData.append('files', file);
      });
      formData.append('providers', JSON.stringify(selectedProviders));

      const response = await fetch('/api/cloud-storage-integration/upload/bulk', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      const data = await response.json();
      
      if (data.success) {
        alert('Upload completed successfully');
        setSelectedFiles(null);
        setSelectedProviders([]);
        // Reset file input
        const fileInput = document.getElementById('file-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        alert('Upload failed: ' + data.error);
      }
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const getQuotaInfo = async (provider: string): Promise<QuotaInfo | null> => {
    try {
      const response = await fetch(`/api/cloud-storage-integration/quota/${provider}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();
      return data.success ? data.quota : null;
    } catch (error) {
      console.error('Failed to get quota:', error);
      return null;
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Cloud className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p>Loading cloud storage providers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-cloud-storage-manager">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" data-testid="heading-cloud-storage">Cloud Storage Manager</h1>
          <p className="text-foreground" data-testid="text-page-description">Manage your cloud storage integrations and file uploads</p>
        </div>
        <Button onClick={fetchProviders} variant="outline" data-testid="button-refresh-providers">
          <Cloud className="mr-2 h-4 w-4" />
          Refresh Status
        </Button>
      </div>

      {/* Provider Status */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6" data-testid="container-providers">
        {providers.map((provider) => (
          <Card key={provider.id} className="relative" data-testid={`card-provider-${provider.type}`}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg" data-testid={`text-provider-name-${provider.type}`}>{provider.name}</CardTitle>
                {provider.isActive ? (
                  <Badge variant="default" className="bg-green-500/20 text-green-400" data-testid={`badge-status-${provider.type}`}>
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Active
                  </Badge>
                ) : (
                  <Badge variant="destructive" data-testid={`badge-status-${provider.type}`}>
                    <XCircle className="mr-1 h-3 w-3" />
                    Inactive
                  </Badge>
                )}
              </div>
              <CardDescription data-testid={`text-provider-config-${provider.type}`}>
                {provider.credentials ? 'Configured' : 'Not configured'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {provider.isActive && (
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Storage Used</span>
                      <span data-testid={`text-quota-${provider.type}`}>{formatBytes(provider.quotaUsed)} / {formatBytes(provider.quotaLimit)}</span>
                    </div>
                    <Progress 
                      value={(provider.quotaUsed / provider.quotaLimit) * 100} 
                      className="h-2"
                      data-testid={`progress-quota-${provider.type}`}
                    />
                  </div>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedProviders.includes(provider.id)}
                      onChange={() => handleProviderToggle(provider.id)}
                      className="rounded"
                      data-testid={`checkbox-provider-${provider.type}`}
                    />
                    <span className="text-sm">Use for uploads</span>
                  </label>
                </div>
              )}
              {!provider.isActive && (
                <Alert data-testid={`alert-provider-inactive-${provider.type}`}>
                  <AlertDescription>
                    Provider not configured. Please check your environment variables.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* File Upload Section */}
      <Card data-testid="card-file-upload">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Upload className="mr-2 h-5 w-5" />
            Upload Files
          </CardTitle>
          <CardDescription>
            Upload files to your selected cloud storage providers
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label htmlFor="file-input" className="block text-sm font-medium mb-2">
              Select Files
            </label>
            <input
              id="file-input"
              type="file"
              multiple
              onChange={handleFileSelection}
              className="block w-full text-sm text-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-500/20 file:text-blue-700 hover:file:bg-blue-500/30"
              data-testid="input-file-upload"
            />
          </div>

          {selectedFiles && (
            <div data-testid="container-selected-files">
              <p className="text-sm text-foreground mb-2">
                Selected files ({selectedFiles.length}):
              </p>
              <ul className="text-xs text-foreground space-y-1">
                {Array.from(selectedFiles).map((file, index) => (
                  <li key={index} className="flex justify-between" data-testid={`item-file-${index}`}>
                    <span>{file.name}</span>
                    <span>{formatBytes(file.size)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div data-testid="container-selected-providers">
            <p className="text-sm font-medium mb-2">
              Selected Providers ({selectedProviders.length}):
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedProviders.map(providerId => {
                const provider = providers.find(p => p.id === providerId);
                return provider ? (
                  <Badge key={providerId} variant="secondary" data-testid={`badge-selected-provider-${provider.type}`}>
                    {provider.name}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>

          <Button 
            onClick={handleUpload}
            disabled={!selectedFiles || selectedProviders.length === 0 || uploading}
            className="w-full"
            data-testid="button-upload-files"
          >
            {uploading ? (
              <>
                <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Upload to Selected Providers
              </>
            )}
          </Button>

          {selectedFiles && selectedProviders.length > 0 && (
            <Alert data-testid="alert-encryption-notice">
              <AlertDescription>
                Files will be automatically encrypted for security before upload.
                Sensitive file types (.pdf, .doc, .xls, etc.) receive additional encryption.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Storage Stats */}
      <Card data-testid="card-storage-overview">
        <CardHeader>
          <CardTitle className="flex items-center">
            <HardDrive className="mr-2 h-5 w-5" />
            Storage Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {providers.filter(p => p.isActive).map(provider => (
              <div key={provider.id} className="text-center p-4 border rounded-lg" data-testid={`stat-${provider.type}`}>
                <h3 className="font-medium">{provider.name}</h3>
                <p className="text-2xl font-bold text-blue-600" data-testid={`text-usage-percentage-${provider.type}`}>
                  {Math.round((provider.quotaUsed / provider.quotaLimit) * 100)}%
                </p>
                <p className="text-xs text-foreground" data-testid={`text-usage-bytes-${provider.type}`}>
                  {formatBytes(provider.quotaUsed)} used
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
