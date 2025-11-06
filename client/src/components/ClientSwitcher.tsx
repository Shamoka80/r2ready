import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronsUpDown, Building2 } from 'lucide-react';
import { Button } from './ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from './ui/popover';
import { cn } from '@/lib/utils';
import { useClientContext } from '@/contexts/ClientContext';

interface ClientOrganization {
  id: string;
  legalName: string;
  dbaName?: string;
  primaryContactName: string;
  primaryContactEmail: string;
  isActive: boolean;
}

interface ClientStats {
  facilityCount: number;
  assessmentCount: number;
}

export default function ClientSwitcher() {
  const [open, setOpen] = useState(false);
  const { selectedClientId, setSelectedClient } = useClientContext();

  const { data: clients = [], isLoading } = useQuery<ClientOrganization[]>({
    queryKey: ['/api/client-organizations'],
  });

  const { data: statsMap = {} } = useQuery<Record<string, ClientStats>>({
    queryKey: ['/api/client-organizations/stats'],
    enabled: clients.length > 0,
  });

  const selectedClient = clients.find(c => c.id === selectedClientId);
  const displayName = selectedClient 
    ? (selectedClient.dbaName || selectedClient.legalName)
    : 'All Clients';

  const handleSelect = (clientId: string | null) => {
    setSelectedClient(clientId);
    setOpen(false);
  };

  if (isLoading) {
    return (
      <div className="w-[240px] h-10 bg-muted dark:bg-muted animate-pulse rounded-md" data-testid="client-switcher-loading" />
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[240px] justify-between"
          data-testid="client-switcher-trigger"
        >
          <div className="flex items-center gap-2 truncate">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate" data-testid="client-switcher-selected">{displayName}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" data-testid="client-switcher-popover">
        <Command>
          <CommandInput placeholder="Search clients..." data-testid="client-switcher-search" />
          <CommandList>
            <CommandEmpty>No clients found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="all-clients"
                onSelect={() => handleSelect(null)}
                data-testid="client-switcher-option-all"
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    selectedClientId === null ? "opacity-100" : "opacity-0"
                  )}
                />
                <div className="flex flex-col">
                  <span className="font-medium">All Clients</span>
                  <span className="text-xs text-muted-foreground">
                    View all organizations
                  </span>
                </div>
              </CommandItem>
              {clients.map((client) => {
                const stats = statsMap[client.id];
                return (
                  <CommandItem
                    key={client.id}
                    value={`${client.legalName} ${client.dbaName || ''}`}
                    onSelect={() => handleSelect(client.id)}
                    data-testid={`client-switcher-option-${client.id}`}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedClientId === client.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <div className="flex flex-col flex-1 min-w-0">
                      <span className="font-medium truncate">
                        {client.dbaName || client.legalName}
                      </span>
                      {stats && (
                        <span className="text-xs text-muted-foreground">
                          {stats.facilityCount} {stats.facilityCount === 1 ? 'facility' : 'facilities'} · {stats.assessmentCount} {stats.assessmentCount === 1 ? 'assessment' : 'assessments'}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
