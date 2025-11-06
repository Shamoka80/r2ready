import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from './ui/form';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

const clientSchema = z.object({
  legalName: z.string().min(1, 'Legal name is required'),
  dbaName: z.string().optional(),
  entityType: z.enum(['CORPORATION', 'LLC', 'PARTNERSHIP', 'SOLE_PROPRIETORSHIP', 'NON_PROFIT', 'OTHER']).optional(),
  taxId: z.string().optional(),
  primaryContactName: z.string().min(1, 'Primary contact name is required'),
  primaryContactEmail: z.string().email('Valid email is required'),
  primaryContactPhone: z.string().optional(),
  hqAddress: z.string().min(1, 'Address is required'),
  hqCity: z.string().min(1, 'City is required'),
  hqState: z.string().min(1, 'State is required'),
  hqZipCode: z.string().min(1, 'ZIP code is required'),
  hqCountry: z.string().default('US'),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientOrganization extends ClientFormData {
  id: string;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface EditClientModalProps {
  client: ClientOrganization;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function EditClientModal({ client, open, onOpenChange, onSuccess }: EditClientModalProps) {
  const { toast } = useToast();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      legalName: client.legalName,
      dbaName: client.dbaName || '',
      entityType: client.entityType,
      taxId: client.taxId || '',
      primaryContactName: client.primaryContactName,
      primaryContactEmail: client.primaryContactEmail,
      primaryContactPhone: client.primaryContactPhone || '',
      hqAddress: client.hqAddress,
      hqCity: client.hqCity,
      hqState: client.hqState,
      hqZipCode: client.hqZipCode,
      hqCountry: client.hqCountry || 'US',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        legalName: client.legalName,
        dbaName: client.dbaName || '',
        entityType: client.entityType,
        taxId: client.taxId || '',
        primaryContactName: client.primaryContactName,
        primaryContactEmail: client.primaryContactEmail,
        primaryContactPhone: client.primaryContactPhone || '',
        hqAddress: client.hqAddress,
        hqCity: client.hqCity,
        hqState: client.hqState,
        hqZipCode: client.hqZipCode,
        hqCountry: client.hqCountry || 'US',
      });
    }
  }, [client, open, form]);

  const updateMutation = useMutation({
    mutationFn: async (data: ClientFormData) => {
      const response = await apiRequest('PUT', `/api/client-organizations/${client.id}`, data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client-organizations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/client-organizations', client.id] });
      toast({
        title: 'Success',
        description: 'Client organization updated successfully',
      });
      onOpenChange(false);
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update client organization',
        variant: 'destructive',
      });
    },
  });

  const onSubmit = (data: ClientFormData) => {
    updateMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-edit-client">
        <DialogHeader>
          <DialogTitle>Edit Client Organization</DialogTitle>
          <DialogDescription>
            Update client organization information.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Legal Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acme Corporation" data-testid="input-legalName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dbaName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>DBA Name</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Acme Recycling" data-testid="input-dbaName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="entityType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Entity Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-entityType">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="CORPORATION">Corporation</SelectItem>
                        <SelectItem value="LLC">LLC</SelectItem>
                        <SelectItem value="PARTNERSHIP">Partnership</SelectItem>
                        <SelectItem value="SOLE_PROPRIETORSHIP">Sole Proprietorship</SelectItem>
                        <SelectItem value="NON_PROFIT">Non-Profit</SelectItem>
                        <SelectItem value="OTHER">Other</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="taxId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tax ID</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="XX-XXXXXXX" data-testid="input-taxId" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryContactName"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Primary Contact Name *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="John Smith" data-testid="input-primaryContactName" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryContactEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact Email *</FormLabel>
                    <FormControl>
                      <Input {...field} type="email" placeholder="john@example.com" data-testid="input-primaryContactEmail" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="primaryContactPhone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Primary Contact Phone</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="(555) 123-4567" data-testid="input-primaryContactPhone" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hqAddress"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Headquarters Address *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="123 Main Street" data-testid="input-hqAddress" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hqCity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>City *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="New York" data-testid="input-hqCity" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hqState"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>State *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="NY" data-testid="input-hqState" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hqZipCode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>ZIP Code *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="10001" data-testid="input-hqZipCode" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="hqCountry"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Country *</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="US" data-testid="input-hqCountry" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid="button-submit"
              >
                {updateMutation.isPending ? 'Updating...' : 'Update Client'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
