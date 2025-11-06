import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, Factory, MapPin, CheckCircle, Clock, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, apiGet, apiPost, apiDelete } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { useState } from 'react';

interface ClientFacility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  operatingStatus: 'ACTIVE' | 'INACTIVE' | 'PENDING' | 'MAINTENANCE';
  clientOrganizationId: string;
  clientOrganization: {
    id: string;
    name: string;
  };
  createdAt: string;
  updatedAt: string;
}

interface ClientOrganization {
  id: string;
  name: string;
}

function ClientFacilities() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedOrgFilter, setSelectedOrgFilter] = useState<string>('all');

  // Get organization filter from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const organizationId = urlParams.get('organizationId');

  const { 
    data: clientFacilities = [], 
    isLoading, 
    error 
  } = useQuery<ClientFacility[], ApiError>({
    queryKey: ['clientFacilities'],
    queryFn: () => apiGet<ClientFacility[]>('/api/client-facilities'),
    retry: 2,
  });

  const { 
    data: clientOrgs = [], 
    isLoading: orgsLoading
  } = useQuery<ClientOrganization[], ApiError>({
    queryKey: ['clientOrganizations'],
    queryFn: () => apiGet<ClientOrganization[]>('/api/client-organizations'),
    retry: 2,
  });

  const deleteClientFacility = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/client-facilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientFacilities'] });
      toast({
        title: 'Success',
        description: 'Client facility deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete client facility',
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-jade/10 text-jade';
      case 'INACTIVE':
        return 'bg-gray/10 text-foreground';
      case 'PENDING':
        return 'bg-sunglow/10 text-sunglow';
      case 'MAINTENANCE':
        return 'bg-pumpkin/10 text-pumpkin';
      default:
        return 'bg-gray/10 text-foreground';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <CheckCircle className="h-4 w-4" />;
      case 'PENDING':
        return <Clock className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  // Filter facilities based on organization selection or URL param
  const filteredFacilities = clientFacilities.filter(facility => {
    if (organizationId) {
      return facility.clientOrganizationId === organizationId;
    }
    if (selectedOrgFilter === 'all') {
      return true;
    }
    return facility.clientOrganizationId === selectedOrgFilter;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading client facilities...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <Factory className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Failed to load client facilities</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {error.message || 'Please try again later.'}
        </p>
        <Button onClick={() => window.location.reload()} variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Client Facilities</h1>
          <p className="text-muted-foreground mt-2">
            Manage facilities for your client organizations
          </p>
        </div>
        <Link href="/client-facilities/new" data-testid="link-new-client-facility">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Client Facility
          </Button>
        </Link>
      </div>

      {/* Organization Filter */}
      {!organizationId && clientOrgs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Filter by Organization</CardTitle>
            <CardDescription>
              Show facilities for a specific client organization
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedOrgFilter} onValueChange={setSelectedOrgFilter}>
              <SelectTrigger className="w-[300px]">
                <SelectValue placeholder="Select organization" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Organizations</SelectItem>
                {clientOrgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}

      {filteredFacilities.length === 0 ? (
        <Card className="text-center p-12">
          <Factory className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No client facilities yet</h3>
          <p className="text-muted-foreground mb-6">
            {organizationId 
              ? "This organization doesn't have any facilities yet. Add the first one to get started."
              : "Start by adding your first client facility to manage their assessments."
            }
          </p>
          <Link href="/client-facilities/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add First Client Facility
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredFacilities.map((facility) => (
            <Card key={facility.id} className="hover:shadow-lg transition-shadow" data-testid={`card-client-facility-${facility.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-jade/10 rounded-lg flex items-center justify-center">
                      <Factory className="w-6 h-6 text-jade" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-facility-name-${facility.id}`}>
                        {facility.name}
                      </CardTitle>
                      <p className="text-sm text-muted-foreground" data-testid={`text-facility-org-${facility.id}`}>
                        {facility.clientOrganization.name}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={getStatusColor(facility.operatingStatus)} data-testid={`status-${facility.id}`}>
                    <div className="flex items-center space-x-1">
                      {getStatusIcon(facility.operatingStatus)}
                      <span>{facility.operatingStatus}</span>
                    </div>
                  </Badge>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span data-testid={`text-facility-address-${facility.id}`}>
                      {facility.address}, {facility.city}, {facility.state} {facility.zipCode}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Link href={`/assessments?facilityId=${facility.id}`}>
                    <Button variant="outline" className="w-full">
                      View Assessments
                    </Button>
                  </Link>
                  
                  <div className="flex space-x-2">
                    <Link href={`/client-facilities/${facility.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteClientFacility.mutate(facility.id)}
                      disabled={deleteClientFacility.isPending}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-facility-${facility.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Created {new Date(facility.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientFacilities;