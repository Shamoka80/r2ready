import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Building2, MoreVertical, Eye, Edit, Archive, Plus } from 'lucide-react';
import AddClientModal from '@/components/AddClientModal';
import EditClientModal from '@/components/EditClientModal';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
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
  entityType?: string;
  taxId?: string;
}

interface ClientStats {
  facilityCount: number;
  assessmentCount: number;
  activeAssessmentCount: number;
  completionRate: number;
}

export default function Clients() {
  const [editingClient, setEditingClient] = useState<ClientOrganization | null>(null);
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [clientToArchive, setClientToArchive] = useState<ClientOrganization | null>(null);
  const { toast } = useToast();

  const { data: clients = [], isLoading } = useQuery<ClientOrganization[]>({
    queryKey: ['/api/client-organizations'],
  });

  const { data: statsMap = {} } = useQuery<Record<string, ClientStats>>({
    queryKey: ['/api/client-organizations/stats'],
    enabled: clients.length > 0,
  });

  const archiveMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const response = await apiRequest('DELETE', `/api/client-organizations/${clientId}`);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-organizations'] });
      toast({
        title: 'Success',
        description: 'Client organization archived successfully',
      });
      setArchiveDialogOpen(false);
      setClientToArchive(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to archive client organization',
        variant: 'destructive',
      });
    },
  });

  const handleArchive = (client: ClientOrganization) => {
    setClientToArchive(client);
    setArchiveDialogOpen(true);
  };

  const confirmArchive = () => {
    if (clientToArchive) {
      archiveMutation.mutate(clientToArchive.id);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-4">
        <div className="h-8 bg-muted dark:bg-muted animate-pulse rounded w-1/3" />
        <div className="h-64 bg-muted dark:bg-muted animate-pulse rounded" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-clients">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight" data-testid="text-page-title">
            Client Organizations
          </h1>
          <p className="text-muted-foreground">
            Manage your client organizations and their facilities
          </p>
        </div>
        <AddClientModal />
      </div>

      {clients.length === 0 ? (
        <Card data-testid="card-empty-state">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
            <p className="text-muted-foreground mb-4 text-center max-w-md">
              Get started by adding your first client organization to manage their facilities and assessments.
            </p>
            <AddClientModal
              trigger={
                <Button data-testid="button-add-first-client">
                  <Plus className="h-4 w-4 mr-2" />
                  Add First Client
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Clients</CardTitle>
            <CardDescription>
              {clients.length} {clients.length === 1 ? 'client' : 'clients'} total
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client Name</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-center">Facilities</TableHead>
                  <TableHead className="text-center">Active Assessments</TableHead>
                  <TableHead className="text-center">Progress</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {clients.map((client) => {
                  const stats = statsMap[client.id] || {
                    facilityCount: 0,
                    assessmentCount: 0,
                    activeAssessmentCount: 0,
                    completionRate: 0,
                  };

                  return (
                    <TableRow key={client.id} data-testid={`row-client-${client.id}`}>
                      <TableCell>
                        <div className="flex flex-col">
                          <Link href={`/clients/${client.id}`}>
                            <span className="font-medium hover:underline cursor-pointer" data-testid={`link-client-${client.id}`}>
                              {client.dbaName || client.legalName}
                            </span>
                          </Link>
                          {client.dbaName && (
                            <span className="text-xs text-muted-foreground">
                              {client.legalName}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col text-sm">
                          <span data-testid={`text-contact-name-${client.id}`}>{client.primaryContactName}</span>
                          <span className="text-xs text-muted-foreground" data-testid={`text-contact-email-${client.id}`}>
                            {client.primaryContactEmail}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm" data-testid={`text-location-${client.id}`}>
                          {client.hqCity}, {client.hqState}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" data-testid={`badge-facilities-${client.id}`}>
                          {stats.facilityCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" data-testid={`badge-assessments-${client.id}`}>
                          {stats.activeAssessmentCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-muted dark:bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${stats.completionRate}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground" data-testid={`text-progress-${client.id}`}>
                            {Math.round(stats.completionRate)}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" data-testid={`button-actions-${client.id}`}>
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/clients/${client.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => setEditingClient(client)}
                              data-testid={`action-edit-${client.id}`}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleArchive(client)}
                              className="text-destructive"
                              data-testid={`action-archive-${client.id}`}
                            >
                              <Archive className="h-4 w-4 mr-2" />
                              Archive
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {editingClient && (
        <EditClientModal
          client={editingClient}
          open={!!editingClient}
          onOpenChange={(open) => !open && setEditingClient(null)}
        />
      )}

      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent data-testid="dialog-archive-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Archive Client Organization?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to archive "{clientToArchive?.dbaName || clientToArchive?.legalName}"?
              This action can be reversed later, but the client will no longer appear in active lists.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-archive">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmArchive}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-archive"
            >
              Archive Client
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
