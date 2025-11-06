import { useQuery } from '@tanstack/react-query';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Building2, RefreshCw, AlertCircle } from 'lucide-react';
import { useClientContext } from '@/contexts/ClientContext';
import { useState } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import ClientSwitcher from './ClientSwitcher';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
  hqCity?: string;
  hqState?: string;
  industry?: string;
  serviceType?: string;
}

interface FacilityProfile {
  id: string;
  name: string;
  city: string;
  state: string;
}

export default function ClientContextBanner() {
  const { selectedClientId, selectedClient, clearSelectedClient } = useClientContext();
  const { user } = useAuth();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const { data: client } = useQuery<ClientOrganization>({
    queryKey: ['/api/client-organizations', selectedClientId],
    enabled: !!selectedClientId,
  });

  // Use the client from context if available, otherwise fetch it
  const currentClient = selectedClient || client;

  if (!selectedClientId || !currentClient || !user?.consultantRole) {
    return null;
  }

  const displayName = currentClient.dbaName || currentClient.legalName;

  return (
    <Card
      className="bg-primary/10 dark:bg-primary/20 border-b border-primary/20 px-6 py-3"
      data-testid="banner-client-context"
    >
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-primary" />
          <div className="flex flex-col">
            <span className="text-sm font-medium text-primary/80">Client Context:</span>
            <Badge variant="secondary" className="font-medium" data-testid="badge-client-name">
              {displayName}
            </Badge>
            <p className="text-xs text-primary/70 mt-1">
              {currentClient.hqCity}, {currentClient.hqState} • {currentClient.industry || 'Industry not specified'}
            </p>
            <div className="flex items-center space-x-2 mt-2">
              <Badge variant="outline">
                {currentClient.serviceType ? currentClient.serviceType.replace('_', ' ').toUpperCase() : 'SERVICE TYPE'}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-sm font-medium text-primary/90">
              Assessment Context
            </p>
            <p className="text-xs text-primary/70">
              All data saved for this client
            </p>
          </div>
          <Popover open={switcherOpen} onOpenChange={setSwitcherOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                data-testid="button-switch-client"
                className="border-primary/30 hover:bg-primary/10 dark:border-primary/70 dark:hover:bg-primary/20"
                onClick={() => clearSelectedClient()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Switch Client
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <div className="p-2">
                <ClientSwitcher />
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {/* Assessment context notice */}
      <div className="flex items-center space-x-2 mt-3 p-2 bg-primary/10 dark:bg-primary/80 rounded-md">
        <AlertCircle className="h-4 w-4 text-primary" />
        <p className="text-xs text-primary/80 dark:text-primary/20">
          <strong>Note:</strong> All assessment responses, evidence uploads, and progress will be saved under this client organization.
        </p>
      </div>
    </Card>
  );
}