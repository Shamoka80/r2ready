import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'wouter';
import { Plus, Building, MapPin, Phone, Mail, Edit, Trash2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ApiError, apiGet, apiPost, apiDelete } from '@/api';
import { useToast } from '@/hooks/use-toast';

interface ClientOrganization {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  createdAt: string;
  updatedAt: string;
}

function ClientOrganizations() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { 
    data: clientOrgs = [], 
    isLoading, 
    error 
  } = useQuery<ClientOrganization[], ApiError>({
    queryKey: ['clientOrganizations'],
    queryFn: () => apiGet<ClientOrganization[]>('/api/client-organizations'),
    retry: 2,
  });

  const deleteClientOrg = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/client-organizations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clientOrganizations'] });
      toast({
        title: 'Success',
        description: 'Client organization deleted successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete client organization',
        variant: 'destructive',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-2 text-muted-foreground">Loading client organizations...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <Building className="h-12 w-12 mx-auto mb-4 text-destructive" />
        <h3 className="text-lg font-semibold mb-2">Failed to load client organizations</h3>
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
          <h1 className="text-3xl font-bold">Client Organizations</h1>
          <p className="text-muted-foreground mt-2">
            Manage your client organizations and their information
          </p>
        </div>
        <Link href="/client-organizations/new" data-testid="link-new-client-org">
          <Button className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Client Organization
          </Button>
        </Link>
      </div>

      {clientOrgs.length === 0 ? (
        <Card className="text-center p-12">
          <Building className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No client organizations yet</h3>
          <p className="text-muted-foreground mb-6">
            Start by adding your first client organization to manage their facilities and assessments.
          </p>
          <Link href="/client-organizations/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add First Client Organization
            </Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {clientOrgs.map((org) => (
            <Card key={org.id} className="hover:shadow-lg transition-shadow" data-testid={`card-client-org-${org.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-jade/10 rounded-lg flex items-center justify-center">
                      <Building className="w-6 h-6 text-jade" />
                    </div>
                    <div>
                      <CardTitle className="text-lg" data-testid={`text-org-name-${org.id}`}>
                        {org.name}
                      </CardTitle>
                      <Badge variant="outline" className="mt-1">
                        Active
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4 mr-2" />
                    <span data-testid={`text-org-address-${org.id}`}>
                      {org.address}, {org.city}, {org.state} {org.zipCode}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 mr-2" />
                    <span data-testid={`text-org-contact-${org.id}`}>
                      {org.contactName}
                    </span>
                  </div>
                  
                  <div className="flex items-center text-sm text-muted-foreground">
                    <span className="ml-6" data-testid={`text-org-email-${org.id}`}>
                      {org.contactEmail}
                    </span>
                  </div>
                  
                  {org.contactPhone && (
                    <div className="flex items-center text-sm text-muted-foreground">
                      <Phone className="h-4 w-4 mr-2" />
                      <span data-testid={`text-org-phone-${org.id}`}>
                        {org.contactPhone}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t space-y-2">
                  <Link href={`/client-facilities?organizationId=${org.id}`}>
                    <Button variant="outline" className="w-full">
                      View Facilities
                    </Button>
                  </Link>
                  
                  <div className="flex space-x-2">
                    <Link href={`/client-organizations/${org.id}/edit`} className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Edit className="h-4 w-4 mr-1" />
                        Edit
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteClientOrg.mutate(org.id)}
                      disabled={deleteClientOrg.isPending}
                      className="text-destructive hover:text-destructive"
                      data-testid={`button-delete-org-${org.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-xs text-muted-foreground pt-2 border-t">
                  Created {new Date(org.createdAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default ClientOrganizations;