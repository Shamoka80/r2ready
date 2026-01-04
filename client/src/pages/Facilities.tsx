import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Factory, MapPin, Settings, Trash2, Star, Building, Users, UserPlus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlag } from '@/lib/flags';

interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  operatingStatus: string;
  headcount?: number;
  floorArea?: number;
  isPrimary: boolean;
  isActive: boolean;
  assessmentCount: number;
  createdAt: string;
  updatedAt: string;
}

const facilitySchema = z.object({
  name: z.string().min(1, 'Facility name is required'),
  address: z.string().min(1, 'Address is required'),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  zipCode: z.string().min(1, 'ZIP code is required'),
  country: z.string().default('US'),
  headcount: z.coerce.number().optional(),
  floorArea: z.coerce.number().optional(),
  operatingStatus: z.string().default('ACTIVE'),
  isPrimary: z.boolean().default(false)
});

type FacilityForm = z.infer<typeof facilitySchema>;

export default function Facilities() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState<Facility | null>(null);
  const [managingUsersFacility, setManagingUsersFacility] = useState<Facility | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  
  // Check if multi_facility feature is enabled
  const isMultiFacilityEnabled = useFeatureFlag('multi_facility');

  // Check URL query params to auto-open dialog
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('new') === 'true') {
      setIsCreateDialogOpen(true);
      // Clean up URL
      window.history.replaceState({}, '', '/facilities');
    }
  }, []);

  // Fetch facilities
  const { data: facilitiesData, isLoading, error } = useQuery({
    queryKey: ['facilities'],
    queryFn: () => apiGet<{ facilities: Facility[] }>('/api/facilities')
  });

  // Check license entitlements for facility creation
  const { data: entitlementsData } = useQuery({
    queryKey: ['facility-entitlements'],
    queryFn: () => apiGet<{
      planName: string;
      maxFacilities: number;
      canAddFacility: boolean;
      currentFacilities: number;
      facilityLimitReason?: string;
    }>('/api/facilities/entitlements')
  });

  const facilities = facilitiesData?.facilities || [];
  const entitlements = entitlementsData;

  // Form setup
  const form = useForm<FacilityForm>({
    resolver: zodResolver(facilitySchema),
    defaultValues: {
      name: '',
      address: '',
      city: '',
      state: '',
      zipCode: '',
      country: 'US',
      operatingStatus: 'ACTIVE',
      isPrimary: false
    }
  });

  // Create facility mutation
  const createFacility = useMutation({
    mutationFn: (data: FacilityForm) => apiPost('/api/facilities', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setIsCreateDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'Facility created successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to create facility',
        variant: 'destructive'
      });
    }
  });

  // Update facility mutation
  const updateFacility = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<FacilityForm> }) =>
      apiPut(`/api/facilities/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      setEditingFacility(null);
      toast({
        title: 'Success',
        description: 'Facility updated successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to update facility',
        variant: 'destructive'
      });
    }
  });

  // Delete facility mutation
  const deleteFacility = useMutation({
    mutationFn: (id: string) => apiDelete(`/api/facilities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facilities'] });
      toast({
        title: 'Success',
        description: 'Facility deleted successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to delete facility',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (data: FacilityForm) => {
    if (editingFacility) {
      updateFacility.mutate({ id: editingFacility.id, data });
    } else {
      createFacility.mutate(data);
    }
  };

  const handleEdit = (facility: Facility) => {
    setEditingFacility(facility);
    form.reset({
      name: facility.name,
      address: facility.address,
      city: facility.city,
      state: facility.state,
      zipCode: facility.zipCode,
      country: facility.country,
      headcount: facility.headcount,
      floorArea: facility.floorArea,
      operatingStatus: facility.operatingStatus,
      isPrimary: facility.isPrimary
    });
    setIsCreateDialogOpen(true);
  };

  const handleDelete = (facility: Facility) => {
    if (confirm(`Are you sure you want to delete ${facility.name}?`)) {
      deleteFacility.mutate(facility.id);
    }
  };

  const handleManageUsers = (facility: Facility) => {
    if (!isMultiFacilityEnabled) {
      toast({
        title: 'Feature Not Available',
        description: 'Multi-facility user management is not available for your account.',
        variant: 'destructive'
      });
      return;
    }
    setLocation(`/facilities/${facility.id}/users`);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'bg-green-500/20 text-green-400 border-green-200';
      case 'INACTIVE': return 'bg-muted text-foreground border-muted';
      case 'MAINTENANCE': return 'bg-yellow-500/20 text-yellow-400 border-yellow-200';
      default: return 'bg-muted text-foreground border-muted';
    }
  };

  const getOperationalStatus = (facility: Facility) => {
    return facility.operatingStatus === 'ACTIVE' && facility.isActive;
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading facilities...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-500 text-center">
          Failed to load facilities. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Facilities Management</h1>
          <p className="text-muted-foreground">
            Manage your organization's facilities and locations
            {entitlements && (
              <span className="ml-2 text-sm">
                • {entitlements.planName} Plan ({entitlements.currentFacilities}/{entitlements.maxFacilities} facilities)
              </span>
            )}
          </p>
        </div>
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={(open) => {
            setIsCreateDialogOpen(open);
            if (!open) {
              setEditingFacility(null);
              form.reset();
            }
          }}
        >
          <DialogTrigger asChild>
            <Button
              disabled={!entitlements?.canAddFacility}
              title={entitlements?.facilityLimitReason}
              data-testid="button-add-facility"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Facility
              {entitlements && !entitlements.canAddFacility && (
                <span className="ml-2 text-xs">({entitlements.currentFacilities}/{entitlements.maxFacilities})</span>
              )}
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle data-testid="heading-facility-dialog">
                {editingFacility ? 'Edit Facility' : 'Create New Facility'}
              </DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Facility Name *</FormLabel>
                        <FormControl>
                          <Input placeholder="Main Processing Center" {...field} data-testid="input-facility-name" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem className="md:col-span-2">
                        <FormLabel>Street Address *</FormLabel>
                        <FormControl>
                          <Input placeholder="123 Industrial Way" {...field} data-testid="input-facility-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City *</FormLabel>
                        <FormControl>
                          <Input placeholder="Austin" {...field} data-testid="input-facility-city" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State *</FormLabel>
                        <FormControl>
                          <Input placeholder="TX" {...field} data-testid="input-facility-state" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="zipCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ZIP Code *</FormLabel>
                        <FormControl>
                          <Input placeholder="78701" {...field} data-testid="input-facility-zipcode" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="operatingStatus"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Operating Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-operating-status">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="ACTIVE">Active</SelectItem>
                            <SelectItem value="INACTIVE">Inactive</SelectItem>
                            <SelectItem value="MAINTENANCE">Maintenance</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="headcount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Headcount</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="25" {...field} data-testid="input-headcount" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="floorArea"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Floor Area (sq ft)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="50000" {...field} data-testid="input-floor-area" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="isPrimary"
                    render={({ field }) => (
                      <FormItem className="flex items-center space-x-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            data-testid="checkbox-is-primary"
                          />
                        </FormControl>
                        <FormLabel className="text-sm font-normal">
                          Set as primary facility
                        </FormLabel>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                    data-testid="button-cancel-facility"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={createFacility.isPending || updateFacility.isPending}
                    data-testid="button-submit-facility"
                  >
                    {editingFacility ? 'Update' : 'Create'} Facility
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Facilities Grid */}
      {facilities.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Factory className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Facilities Yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Get started by adding your first facility location
            </p>
            {entitlements?.canAddFacility ? (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add First Facility
              </Button>
            ) : (
              <div className="text-center">
                <p className="text-sm text-destructive mb-2">
                  {entitlements?.facilityLimitReason}
                </p>
                <Button variant="outline" disabled>
                  License Limit Reached
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {facilities.map((facility) => (
            <Card key={facility.id} className="relative" data-testid={`card-facility-${facility.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-muted-foreground" />
                    <CardTitle className="text-lg" data-testid={`text-facility-name-${facility.id}`}>{facility.name}</CardTitle>
                    {facility.isPrimary && (
                      <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    )}
                  </div>
                  <div className="flex space-x-1">
                    {isMultiFacilityEnabled && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleManageUsers(facility)}
                        title="Manage Users"
                        data-testid={`button-manage-users-${facility.id}`}
                      >
                        <Users className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(facility)}
                      title="Edit Facility"
                      data-testid={`button-edit-${facility.id}`}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(facility)}
                      disabled={facility.isPrimary}
                      title="Delete Facility"
                      data-testid={`button-delete-${facility.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className={`${getStatusColor(facility.operatingStatus)} border`} data-testid={`badge-status-${facility.id}`}>
                      <div className="flex items-center gap-1">
                        <div className={`w-2 h-2 rounded-full ${
                          getOperationalStatus(facility) ? 'bg-green-500' : 'bg-yellow-500'
                        }`}></div>
                        {facility.operatingStatus}
                      </div>
                    </Badge>
                    {!getOperationalStatus(facility) && (
                      <Badge variant="destructive" className="text-xs">
                        Not Available for Assessments
                      </Badge>
                    )}
                  </div>
                  {facility.isPrimary && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-200 text-xs">
                      Primary Facility
                    </Badge>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center text-sm text-muted-foreground" data-testid={`text-facility-address-${facility.id}`}>
                    <MapPin className="h-4 w-4 mr-2" />
                    <span>
                      {facility.address}, {facility.city}, {facility.state} {facility.zipCode}
                    </span>
                  </div>

                  {facility.headcount && (
                    <div className="text-sm text-muted-foreground" data-testid={`text-headcount-${facility.id}`}>
                      <strong>Headcount:</strong> {facility.headcount}
                    </div>
                  )}

                  {facility.floorArea && (
                    <div className="text-sm text-muted-foreground" data-testid={`text-floor-area-${facility.id}`}>
                      <strong>Floor Area:</strong> {facility.floorArea} sq ft
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground" data-testid={`text-assessment-count-${facility.id}`}>
                    <strong>Assessments:</strong> {facility.assessmentCount}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}