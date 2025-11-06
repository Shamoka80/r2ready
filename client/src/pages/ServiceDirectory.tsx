
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Search, Server, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ServiceEndpoint {
  id: string;
  name: string;
  path: string;
  method: string;
  description: string;
  category: string;
  version: string;
  status: 'active' | 'deprecated' | 'maintenance';
  authentication: boolean;
  rateLimit?: string;
}

interface ServiceCategory {
  id: string;
  name: string;
  description: string;
  endpoints: ServiceEndpoint[];
}

interface ServiceDirectoryData {
  services: ServiceCategory[];
  health: { [categoryId: string]: string };
}

const ServiceDirectory: React.FC = () => {
  const [directoryData, setDirectoryData] = useState<ServiceDirectoryData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ServiceEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  useEffect(() => {
    fetchServiceDirectory();
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      performSearch();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const fetchServiceDirectory = async () => {
    try {
      const response = await fetch('/api/directory');
      const data = await response.json();
      if (data.success) {
        setDirectoryData(data);
      }
    } catch (error) {
      console.error('Failed to fetch service directory:', error);
    } finally {
      setLoading(false);
    }
  };

  const performSearch = async () => {
    try {
      const response = await fetch(`/api/directory/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      if (data.success) {
        setSearchResults(data.results);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'deprecated':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'maintenance':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return null;
    }
  };

  const getMethodColor = (method: string) => {
    switch (method.toUpperCase()) {
      case 'GET':
        return 'bg-green-100 text-green-800';
      case 'POST':
        return 'bg-blue-100 text-blue-800';
      case 'PUT':
        return 'bg-orange-100 text-orange-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const renderEndpoint = (endpoint: ServiceEndpoint) => (
    <Card key={endpoint.id} className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className={getMethodColor(endpoint.method)}>
              {endpoint.method}
            </Badge>
            <code className="text-sm bg-gray-100 px-2 py-1 rounded">
              {endpoint.path}
            </code>
            {getStatusIcon(endpoint.status)}
          </div>
          <Badge variant="outline">v{endpoint.version}</Badge>
        </div>
        <CardTitle className="text-lg">{endpoint.name}</CardTitle>
        <CardDescription>{endpoint.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 text-sm text-gray-600">
          <span>Auth: {endpoint.authentication ? '✓ Required' : '✗ Not Required'}</span>
          {endpoint.rateLimit && <span>Rate limit: {endpoint.rateLimit}</span>}
        </div>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <Server className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p>Loading service directory...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">API Service Directory</h1>
        <p className="text-gray-600">Discover and explore all available RuR2 API services</p>
      </div>

      {/* Search */}
      <div className="relative max-w-md mx-auto">
        <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
        <Input
          placeholder="Search services..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">
            Search Results ({searchResults.length})
          </h2>
          <div className="space-y-4">
            {searchResults.map(renderEndpoint)}
          </div>
        </div>
      )}

      {/* Service Categories */}
      {!searchQuery && directoryData && (
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory}>
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="all">All Services</TabsTrigger>
            {directoryData.services.map((category) => (
              <TabsTrigger key={category.id} value={category.id}>
                {category.name}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            {directoryData.services.map((category) => (
              <div key={category.id}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-2xl font-semibold">{category.name}</h2>
                  <Badge variant="secondary">
                    {directoryData.health[category.id]}
                  </Badge>
                </div>
                <p className="text-gray-600 mb-4">{category.description}</p>
                <div className="space-y-4">
                  {category.endpoints.map(renderEndpoint)}
                </div>
              </div>
            ))}
          </TabsContent>

          {directoryData.services.map((category) => (
            <TabsContent key={category.id} value={category.id} className="space-y-4">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{category.name}</h2>
                <p className="text-gray-600 mb-4">{category.description}</p>
                <Badge variant="secondary">
                  {directoryData.health[category.id]}
                </Badge>
              </div>
              <div className="space-y-4">
                {category.endpoints.map(renderEndpoint)}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
};

export default ServiceDirectory;
