
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import { 
  Users, 
  UserPlus, 
  Settings, 
  Trash2, 
  ArrowLeft,
  Shield,
  Building,
  Mail,
  UserCheck
} from 'lucide-react';
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
import { apiGet, apiPost, apiDelete } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { useFeatureFlag } from '@/lib/flags';

interface FacilityUser {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  businessRole: string;
  consultantRole?: string;
  role: string;
  permissions: string[];
  assignedAt: string;
  assignedBy: string;
}

interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
}

const assignUserSchema = z.object({
  userId: z.string().uuid('Valid user ID is required'),
  facilityRole: z.string().optional(),
  permissions: z.array(z.string()).default([]),
  canManageUsers: z.boolean().default(false),
  canManageAssessments: z.boolean().default(true),
  canViewReports: z.boolean().default(true),
  canEditFacility: z.boolean().default(false)
});

type AssignUserForm = z.infer<typeof assignUserSchema>;

const FACILITY_ROLES = [
  { value: 'facility_manager', label: 'Facility Manager' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
  { value: 'team_member', label: 'Team Member' },
  { value: 'viewer', label: 'Viewer' }
];

const FACILITY_PERMISSIONS = [
  { value: 'manage_users', label: 'Manage Users' },
  { value: 'manage_assessments', label: 'Manage Assessments' },
  { value: 'view_reports', label: 'View Reports' },
  { value: 'edit_facility', label: 'Edit Facility' }
];

// Enhanced user interface for RBAC system
interface EnhancedFacilityUser extends FacilityUser {
  facilityRole?: string;
  canManageUsers?: boolean;
  canManageAssessments?: boolean;
  canViewReports?: boolean;
  canEditFacility?: boolean;
}

export default function FacilityUserManagement() {
  const { facilityId } = useParams();
  const [, navigate] = useLocation();
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Check if multi_facility feature is enabled
  const isMultiFacilityEnabled = useFeatureFlag('multi_facility');

  if (!facilityId) {
    navigate('/facilities');
    return null;
  }

  // Redirect if feature is not enabled
  if (!isMultiFacilityEnabled) {
    navigate('/facilities');
    return null;
  }

  // Fetch facility details and users
  const { data: facilityData, isLoading: facilityLoading } = useQuery({
    queryKey: ['facility', facilityId],
    queryFn: () => apiGet<Facility>(`/api/facilities/${facilityId}`)
  });

  const { data: usersData, isLoading: usersLoading } = useQuery({
    queryKey: ['facility-users', facilityId],
    queryFn: () => apiGet<{ facility: Facility; users: EnhancedFacilityUser[] }>(`/api/rbac/facilities/${facilityId}/users`)
  });

  // Fetch available users for assignment
  const { data: availableUsers } = useQuery({
    queryKey: ['availableUsers'],
    queryFn: () => apiGet<any[]>('/api/auth/users')
  });

  const facility = facilityData;
  const users = usersData?.users || [];

  // Form setup
  const form = useForm<AssignUserForm>({
    resolver: zodResolver(assignUserSchema),
    defaultValues: {
      userId: '',
      facilityRole: 'viewer',
      permissions: [],
      canManageUsers: false,
      canManageAssessments: true,
      canViewReports: true,
      canEditFacility: false
    }
  });

  // Assign user mutation using new RBAC system
  const assignUser = useMutation({
    mutationFn: (data: AssignUserForm) => 
      apiPost(`/api/rbac/facilities/${facilityId}/assign-user`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-users', facilityId] });
      setIsAssignDialogOpen(false);
      form.reset();
      toast({
        title: 'Success',
        description: 'User assigned to facility successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to assign user',
        variant: 'destructive'
      });
    }
  });

  // Remove user mutation using new RBAC system
  const removeUser = useMutation({
    mutationFn: (userId: string) => 
      apiDelete(`/api/rbac/facilities/${facilityId}/users/${userId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['facility-users', facilityId] });
      toast({
        title: 'Success',
        description: 'User removed from facility successfully'
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'Failed to remove user',
        variant: 'destructive'
      });
    }
  });

  const handleSubmit = (data: AssignUserForm) => {
    assignUser.mutate(data);
  };

  const handleRemoveUser = (user: FacilityUser) => {
    if (confirm(`Remove ${user.firstName} ${user.lastName} from this facility?`)) {
      removeUser.mutate(user.userId);
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'facility_admin': return 'bg-red-500/20 text-red-400';
      case 'facility_manager': return 'bg-blue-500/20 text-blue-400';
      case 'compliance_officer': return 'bg-green-500/20 text-green-400';
      case 'team_member': return 'bg-yellow-500/20 text-yellow-400';
      case 'viewer': return 'bg-muted text-foreground';
      default: return 'bg-muted text-foreground';
    }
  };

  const getRoleLabel = (role: string) => {
    const roleObj = FACILITY_ROLES.find(r => r.value === role);
    return roleObj?.label || role;
  };

  if (facilityLoading || usersLoading) {
    return (
      <div className="p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading facility users...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate('/facilities')}
            data-testid="button-back-to-facilities"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Facilities
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Users className="h-8 w-8 mr-3" />
              User Management
            </h1>
            <p className="text-muted-foreground flex items-center mt-1">
              <Building className="h-4 w-4 mr-2" />
              {facility?.name || 'Unknown Facility'}
            </p>
          </div>
        </div>
        
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-assign-user">
              <UserPlus className="h-4 w-4 mr-2" />
              Assign User
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign User to Facility</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="userId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>User ID *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="Enter user ID" 
                          {...field} 
                          data-testid="input-user-id"
                        />
                      </FormControl>
                      <p className="text-xs text-muted-foreground">
                        User must already exist in your organization
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="facilityRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Facility Role *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-facility-role">
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FACILITY_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="permissions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Additional Permissions</FormLabel>
                      <div className="grid grid-cols-2 gap-2">
                        {FACILITY_PERMISSIONS.map((permission) => (
                          <div key={permission.value} className="flex items-center space-x-2">
                            <Checkbox
                              checked={field.value?.includes(permission.value)}
                              onCheckedChange={(checked) => {
                                const currentPermissions = field.value || [];
                                if (checked) {
                                  field.onChange([...currentPermissions, permission.value]);
                                } else {
                                  field.onChange(currentPermissions.filter(p => p !== permission.value));
                                }
                              }}
                            />
                            <label className="text-sm">{permission.label}</label>
                          </div>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAssignDialogOpen(false)}
                    data-testid="button-cancel-assign"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={assignUser.isPending}
                    data-testid="button-submit-assign-user"
                  >
                    Assign User
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Users List */}
      {users.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCheck className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Users Assigned</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by assigning users to this facility
            </p>
            <Button onClick={() => setIsAssignDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Assign First User
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {users.map((user) => (
            <Card key={user.id} data-testid={`card-user-${user.id}`}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg" data-testid={`text-user-name-${user.id}`}>
                      {user.firstName} {user.lastName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground flex items-center" data-testid={`text-user-email-${user.id}`}>
                      <Mail className="h-3 w-3 mr-1" />
                      {user.email}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleRemoveUser(user)}
                    title="Remove from facility"
                    data-testid={`button-remove-user-${user.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Badge className={getRoleColor(user.role)} data-testid={`badge-user-role-${user.id}`}>
                    <Shield className="h-3 w-3 mr-1" />
                    {getRoleLabel(user.role)}
                  </Badge>
                </div>

                {user.businessRole && (
                  <div className="text-sm">
                    <strong>Organization Role:</strong> {user.businessRole}
                  </div>
                )}

                {user.permissions && user.permissions.length > 0 && (
                  <div className="text-sm">
                    <strong>Permissions:</strong>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {user.permissions.map((permission) => (
                        <Badge key={permission} variant="outline" className="text-xs">
                          {FACILITY_PERMISSIONS.find(p => p.value === permission)?.label || permission}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <div className="text-xs text-muted-foreground">
                  Assigned: {new Date(user.assignedAt).toLocaleDateString()}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
