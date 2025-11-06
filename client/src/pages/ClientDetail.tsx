import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute, useParams, Link } from 'wouter';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Plus,
  ArrowLeft,
  FileText,
  Edit,
} from 'lucide-react';
import EditClientModal from '@/components/EditClientModal';

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
  entityType?: string;
  taxId?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone?: string;
  hqAddress: string;
  hqCity: string;
  hqState: string;
  hqZipCode: string;
  hqCountry: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  clientFacilities?: ClientFacility[];
}

interface ClientFacility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isActive: boolean;
}

interface Assessment {
  id: string;
  title: string;
  status: string;
  progress: {
    answered: number;
    total: number;
  };
  createdAt: string;
  updatedAt: string;
}

export default function ClientDetail() {
  const [match] = useRoute('/clients/:id');
  const params = useParams();
  const clientId = match && params ? params.id : null;
  const [editModalOpen, setEditModalOpen] = useState(false);

  const { data: client, isLoading } = useQuery<ClientOrganization>({
    queryKey: ['/api/client-organizations', clientId],
    enabled: !!clientId,
  });

  const { data: facilities = [] } = useQuery<ClientFacility[]>({
    queryKey: ['/api/client-organizations', clientId, 'facilities'],
    enabled: !!clientId,
  });

  const { data: assessments = [] } = useQuery<Assessment[]>({
    queryKey: ['/api/assessments'],
    select: (data: Assessment[]) => {
      return data.filter((a: any) => a.clientOrganizationId === clientId);
    },
    enabled: !!clientId,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="h-8 bg-muted dark:bg-muted animate-pulse rounded w-1/3" />
        <div className="h-64 bg-muted dark:bg-muted animate-pulse rounded" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center space-y-4">
          <Building2 className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-2xl font-bold">Client not found</h2>
          <Link href="/clients">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Clients
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const activeAssessments = assessments.filter(a => a.status === 'IN_PROGRESS' || a.status === 'DRAFT');
  const completedAssessments = assessments.filter(a => a.status === 'COMPLETED');

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-client-detail">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/clients">
            <Button variant="ghost" size="icon" data-testid="button-back">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" data-testid="text-client-name">
              {client.dbaName || client.legalName}
            </h1>
            {client.dbaName && (
              <p className="text-muted-foreground" data-testid="text-legal-name">
                {client.legalName}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => setEditModalOpen(true)} data-testid="button-edit-client">
          <Edit className="h-4 w-4 mr-2" />
          Edit Client
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card data-testid="card-client-profile">
          <CardHeader>
            <CardTitle>Client Profile</CardTitle>
            <CardDescription>Organization information and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3">
              <div className="flex items-start gap-3">
                <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Legal Name</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-legalName">
                    {client.legalName}
                  </p>
                </div>
              </div>

              {client.entityType && (
                <div className="flex items-start gap-3">
                  <Building2 className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Entity Type</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-profile-entityType">
                      {client.entityType}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Primary Contact</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-contact">
                    {client.primaryContactName}
                  </p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-email">
                    {client.primaryContactEmail}
                  </p>
                </div>
              </div>

              {client.primaryContactPhone && (
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-profile-phone">
                      {client.primaryContactPhone}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">Headquarters</p>
                  <p className="text-sm text-muted-foreground" data-testid="text-profile-address">
                    {client.hqAddress}<br />
                    {client.hqCity}, {client.hqState} {client.hqZipCode}<br />
                    {client.hqCountry}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-quick-actions">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks for this client</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button className="w-full justify-start" variant="outline" data-testid="button-start-assessment">
              <FileText className="h-4 w-4 mr-2" />
              Start New Assessment
            </Button>
            <Button className="w-full justify-start" variant="outline" data-testid="button-add-facility">
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card data-testid="card-facilities">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Facilities</CardTitle>
              <CardDescription>
                {facilities.length} {facilities.length === 1 ? 'facility' : 'facilities'}
              </CardDescription>
            </div>
            <Button size="sm" variant="outline" data-testid="button-add-facility-table">
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {facilities.length === 0 ? (
            <div className="text-center py-8">
              <Building2 className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No facilities yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((facility) => (
                  <TableRow key={facility.id} data-testid={`row-facility-${facility.id}`}>
                    <TableCell className="font-medium" data-testid={`text-facility-name-${facility.id}`}>
                      {facility.name}
                    </TableCell>
                    <TableCell data-testid={`text-facility-location-${facility.id}`}>
                      {facility.city}, {facility.state}
                    </TableCell>
                    <TableCell>
                      <Badge variant={facility.isActive ? 'default' : 'secondary'} data-testid={`badge-facility-status-${facility.id}`}>
                        {facility.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-assessments">
        <CardHeader>
          <CardTitle>Active Assessments</CardTitle>
          <CardDescription>
            {activeAssessments.length} active · {completedAssessments.length} completed
          </CardDescription>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="text-center py-8">
              <FileText className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No assessments yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assessment Title</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Last Updated</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((assessment) => {
                  const progressPercent = assessment.progress.total > 0
                    ? (assessment.progress.answered / assessment.progress.total) * 100
                    : 0;

                  return (
                    <TableRow key={assessment.id} data-testid={`row-assessment-${assessment.id}`}>
                      <TableCell>
                        <Link href={`/assessments/${assessment.id}`}>
                          <span className="font-medium hover:underline cursor-pointer" data-testid={`link-assessment-${assessment.id}`}>
                            {assessment.title}
                          </span>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={assessment.status === 'COMPLETED' ? 'default' : 'secondary'}
                          data-testid={`badge-assessment-status-${assessment.id}`}
                        >
                          {assessment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={progressPercent} className="w-20" />
                          <span className="text-xs text-muted-foreground" data-testid={`text-assessment-progress-${assessment.id}`}>
                            {assessment.progress.answered}/{assessment.progress.total}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground" data-testid={`text-assessment-updated-${assessment.id}`}>
                        {new Date(assessment.updatedAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {editModalOpen && (
        <EditClientModal
          client={client}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
        />
      )}
    </div>
  );
}
