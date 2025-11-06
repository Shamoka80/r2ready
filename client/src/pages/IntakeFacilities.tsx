import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Pencil, Trash2, Plus, ArrowLeft, Building2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface IntakeFacility {
  id: string;
  intakeFormId: string;
  facilityNumber: string;
  nameIdentifier: string | null;
  address: string | null;
  squareFootage: string | null;
  zoning: string | null;
  employeesAtLocation: string | null;
  shifts: string | null;
  primaryFunction: string | null;
  processingActivities: string[] | null;
  equipment: string[] | null;
  electronicsTypes: string[] | null;
  createdAt: string;
}

const PROCESSING_ACTIVITIES = [
  { value: "REPAIR", label: "Repair" },
  { value: "REFURBISHMENT", label: "Refurbishment" },
  { value: "RECYCLING", label: "Recycling" },
  { value: "COLLECTION", label: "Collection" },
  { value: "SORTING", label: "Sorting" },
  { value: "DISASSEMBLY", label: "Disassembly" },
  { value: "SHREDDING", label: "Shredding" },
  { value: "RECOVERY", label: "Recovery" },
  { value: "STORAGE", label: "Storage" },
  { value: "TRANSPORTATION", label: "Transportation" },
  { value: "OTHER", label: "Other" },
];

const EQUIPMENT_OPTIONS = [
  { value: "SHREDDERS", label: "Shredders" },
  { value: "CONVEYORS", label: "Conveyors" },
  { value: "SORTING_EQUIPMENT", label: "Sorting Equipment" },
  { value: "BALERS", label: "Balers" },
  { value: "GRANULATORS", label: "Granulators" },
  { value: "TESTING_EQUIPMENT", label: "Testing Equipment" },
  { value: "DATA_WIPING_STATIONS", label: "Data Wiping Stations" },
];

const ELECTRONICS_TYPES = [
  { value: "COMPUTERS", label: "Computers" },
  { value: "LAPTOPS", label: "Laptops" },
  { value: "MOBILE_DEVICES", label: "Mobile Devices" },
  { value: "SERVERS", label: "Servers" },
  { value: "NETWORKING_EQUIPMENT", label: "Networking Equipment" },
  { value: "PRINTERS", label: "Printers" },
  { value: "MONITORS", label: "Monitors" },
  { value: "TELEVISIONS", label: "Televisions" },
  { value: "BATTERIES", label: "Batteries" },
];

const facilityFormSchema = z.object({
  nameIdentifier: z.string().min(1, "Facility name is required"),
  address: z.string().optional(),
  squareFootage: z.string().optional(),
  zoning: z.string().optional(),
  employeesAtLocation: z.string().optional(),
  shifts: z.string().optional(),
  primaryFunction: z.string().optional(),
  processingActivities: z.array(z.string()).min(1, "Select at least one processing activity"),
  equipment: z.array(z.string()).min(1, "Select at least one equipment type"),
  electronicsTypes: z.array(z.string()).min(1, "Select at least one electronics type"),
});

type FacilityFormData = z.infer<typeof facilityFormSchema>;

export default function IntakeFacilities() {
  const [, params] = useRoute("/intake-facilities/:intakeFormId");
  const intakeFormId = params?.intakeFormId;
  const { toast } = useToast();
  const [editingFacility, setEditingFacility] = useState<IntakeFacility | null>(null);
  const [deletingFacility, setDeletingFacility] = useState<IntakeFacility | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const form = useForm<FacilityFormData>({
    resolver: zodResolver(facilityFormSchema),
    defaultValues: {
      nameIdentifier: "",
      address: "",
      squareFootage: "",
      zoning: "",
      employeesAtLocation: "",
      shifts: "",
      primaryFunction: "",
      processingActivities: [],
      equipment: [],
      electronicsTypes: [],
    },
  });

  const { data: facilities, isLoading } = useQuery<IntakeFacility[]>({
    queryKey: ["/api/intake-facilities", intakeFormId],
    enabled: !!intakeFormId,
  });

  const updateMutation = useMutation({
    mutationFn: async (data: { id: string; updates: Partial<FacilityFormData> }) => {
      const response = await fetch(`/api/intake-facilities/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data.updates),
      });
      if (!response.ok) throw new Error("Failed to update facility");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-facilities", intakeFormId] });
      toast({
        title: "Success",
        description: "Facility updated successfully",
      });
      setEditingFacility(null);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update facility",
        variant: "destructive",
      });
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FacilityFormData) => {
      const response = await fetch("/api/intake-facilities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...data, intakeFormId }),
      });
      if (!response.ok) throw new Error("Failed to create facility");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-facilities", intakeFormId] });
      toast({
        title: "Success",
        description: "Facility created successfully",
      });
      setIsCreating(false);
      form.reset();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create facility",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/intake-facilities/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) throw new Error("Failed to delete facility");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/intake-facilities", intakeFormId] });
      toast({
        title: "Success",
        description: "Facility deleted successfully",
      });
      setDeletingFacility(null);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete facility",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (facility: IntakeFacility) => {
    setEditingFacility(facility);
    form.reset({
      nameIdentifier: facility.nameIdentifier || "",
      address: facility.address || "",
      squareFootage: facility.squareFootage || "",
      zoning: facility.zoning || "",
      employeesAtLocation: facility.employeesAtLocation || "",
      shifts: facility.shifts || "",
      primaryFunction: facility.primaryFunction || "",
      processingActivities: facility.processingActivities || [],
      equipment: facility.equipment || [],
      electronicsTypes: facility.electronicsTypes || [],
    });
  };

  const handleCreate = () => {
    setIsCreating(true);
    form.reset({
      nameIdentifier: "",
      address: "",
      squareFootage: "",
      zoning: "",
      employeesAtLocation: "",
      shifts: "",
      primaryFunction: "",
      processingActivities: [],
      equipment: [],
      electronicsTypes: [],
    });
  };

  const onSubmit = (data: FacilityFormData) => {
    if (editingFacility) {
      updateMutation.mutate({ id: editingFacility.id, updates: data });
    } else if (isCreating) {
      createMutation.mutate(data);
    }
  };

  if (!intakeFormId) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardHeader>
            <CardTitle data-testid="text-error-title">Error</CardTitle>
            <CardDescription data-testid="text-error-message">Invalid intake form ID</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2" data-testid="text-page-title">
              <Building2 className="h-8 w-8" />
              Manage Facilities
            </h1>
            <p className="text-muted-foreground mt-1" data-testid="text-page-description">
              Edit individual facility processing data for REC mapping
            </p>
          </div>
        </div>
        <Button onClick={handleCreate} data-testid="button-create-facility">
          <Plus className="h-4 w-4 mr-2" />
          Add Facility
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Facilities List</CardTitle>
          <CardDescription data-testid="text-facility-count">
            {facilities?.length || 0} {facilities?.length === 1 ? "facility" : "facilities"} configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground" data-testid="text-loading-facilities">Loading facilities...</div>
          ) : facilities && facilities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Facility #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Processing Activities</TableHead>
                  <TableHead>Equipment</TableHead>
                  <TableHead>Electronics Types</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {facilities.map((facility) => (
                  <TableRow key={facility.id} data-testid={`row-facility-${facility.id}`}>
                    <TableCell className="font-medium" data-testid={`text-facility-number-${facility.id}`}>{facility.facilityNumber}</TableCell>
                    <TableCell data-testid={`text-facility-name-${facility.id}`}>{facility.nameIdentifier || "Unnamed"}</TableCell>
                    <TableCell data-testid={`text-processing-activities-${facility.id}`}>
                      <div className="flex flex-wrap gap-1">
                        {facility.processingActivities?.slice(0, 2).map((activity: string) => (
                          <span
                            key={activity}
                            className="inline-flex items-center rounded-full bg-blue-500/10 px-2 py-1 text-xs font-medium text-blue-400"
                            data-testid={`badge-activity-${activity.toLowerCase()}-${facility.id}`}
                          >
                            {activity}
                          </span>
                        ))}
                        {(facility.processingActivities?.length || 0) > 2 && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-more-activities-${facility.id}`}>
                            +{(facility.processingActivities?.length || 0) - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-equipment-${facility.id}`}>
                      <div className="flex flex-wrap gap-1">
                        {facility.equipment?.slice(0, 2).map((eq: string) => (
                          <span
                            key={eq}
                            className="inline-flex items-center rounded-full bg-green-500/10 px-2 py-1 text-xs font-medium text-green-400"
                            data-testid={`badge-equipment-${eq.toLowerCase()}-${facility.id}`}
                          >
                            {eq}
                          </span>
                        ))}
                        {(facility.equipment?.length || 0) > 2 && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-more-equipment-${facility.id}`}>
                            +{(facility.equipment?.length || 0) - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell data-testid={`text-electronics-types-${facility.id}`}>
                      <div className="flex flex-wrap gap-1">
                        {facility.electronicsTypes?.slice(0, 2).map((type: string) => (
                          <span
                            key={type}
                            className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-1 text-xs font-medium text-purple-400"
                            data-testid={`badge-electronics-${type.toLowerCase()}-${facility.id}`}
                          >
                            {type}
                          </span>
                        ))}
                        {(facility.electronicsTypes?.length || 0) > 2 && (
                          <span className="text-xs text-muted-foreground" data-testid={`text-more-electronics-${facility.id}`}>
                            +{(facility.electronicsTypes?.length || 0) - 2} more
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(facility)}
                          data-testid={`button-edit-${facility.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingFacility(facility)}
                          data-testid={`button-delete-${facility.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-12" data-testid="text-empty-facilities">
              <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No facilities found. Add your first facility to get started.</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editingFacility !== null || isCreating} onOpenChange={(open) => {
        if (!open) {
          setEditingFacility(null);
          setIsCreating(false);
          form.reset();
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="dialog-facility-form">
          <DialogHeader>
            <DialogTitle data-testid="text-dialog-title">{editingFacility ? "Edit Facility" : "Create New Facility"}</DialogTitle>
            <DialogDescription data-testid="text-dialog-description">
              Update facility-specific processing data for accurate REC mapping
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="nameIdentifier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Facility Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="e.g., Main Processing Center" data-testid="input-facility-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Street address" data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="squareFootage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Square Footage</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 10000" data-testid="input-square-footage" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="zoning"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Zoning</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Industrial" data-testid="input-zoning" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="employeesAtLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employees at Location</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 50" data-testid="input-employees-at-location" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="shifts"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Shifts</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., 2" data-testid="input-shifts" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="primaryFunction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Function</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="e.g., Recycling" data-testid="input-primary-function" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="processingActivities"
                render={() => (
                  <FormItem>
                    <FormLabel>Processing Activities *</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {PROCESSING_ACTIVITIES.map((activity: { value: string; label: string }) => (
                        <FormField
                          key={activity.value}
                          control={form.control}
                          name="processingActivities"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(activity.value)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), activity.value]
                                      : (field.value || []).filter((v) => v !== activity.value);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-activity-${activity.value.toLowerCase()}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {activity.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="equipment"
                render={() => (
                  <FormItem>
                    <FormLabel>Equipment *</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {EQUIPMENT_OPTIONS.map((eq: { value: string; label: string }) => (
                        <FormField
                          key={eq.value}
                          control={form.control}
                          name="equipment"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(eq.value)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), eq.value]
                                      : (field.value || []).filter((v) => v !== eq.value);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-equipment-${eq.value.toLowerCase()}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {eq.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="electronicsTypes"
                render={() => (
                  <FormItem>
                    <FormLabel>Electronics Types *</FormLabel>
                    <div className="grid grid-cols-2 gap-3">
                      {ELECTRONICS_TYPES.map((type: { value: string; label: string }) => (
                        <FormField
                          key={type.value}
                          control={form.control}
                          name="electronicsTypes"
                          render={({ field }) => (
                            <FormItem className="flex items-center space-x-2 space-y-0">
                              <FormControl>
                                <Checkbox
                                  checked={field.value?.includes(type.value)}
                                  onCheckedChange={(checked) => {
                                    const newValue = checked
                                      ? [...(field.value || []), type.value]
                                      : (field.value || []).filter((v) => v !== type.value);
                                    field.onChange(newValue);
                                  }}
                                  data-testid={`checkbox-electronics-${type.value.toLowerCase()}`}
                                />
                              </FormControl>
                              <FormLabel className="font-normal cursor-pointer">
                                {type.label}
                              </FormLabel>
                            </FormItem>
                          )}
                        />
                      ))}
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingFacility(null);
                    setIsCreating(false);
                    form.reset();
                  }}
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updateMutation.isPending || createMutation.isPending}
                  data-testid="button-save-facility"
                >
                  {updateMutation.isPending || createMutation.isPending ? "Saving..." : "Save Facility"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deletingFacility !== null} onOpenChange={(open) => !open && setDeletingFacility(null)}>
        <AlertDialogContent data-testid="dialog-delete-facility">
          <AlertDialogHeader>
            <AlertDialogTitle data-testid="text-delete-title">Delete Facility?</AlertDialogTitle>
            <AlertDialogDescription data-testid="text-delete-description">
              Are you sure you want to delete "{deletingFacility?.nameIdentifier}"? This action cannot be undone.
              The intake form's total facility count will be automatically updated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletingFacility) {
                  deleteMutation.mutate(deletingFacility.id);
                }
              }}
              className="bg-destructive hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
