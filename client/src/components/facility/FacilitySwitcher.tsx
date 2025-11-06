import { useFacilityContext } from '@/contexts/FacilityContext';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Factory, ChevronDown, Building } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function FacilitySwitcher() {
  const queryClient = useQueryClient();
  const { 
    currentFacility, 
    setCurrentFacility, 
    facilities, 
    isLoading, 
    isMultiFacilityEnabled 
  } = useFacilityContext();

  const handleFacilityChange = (facility: any) => {
    setCurrentFacility(facility);
    
    // Invalidate all queries to refetch with new facility context
    queryClient.invalidateQueries();
  };

  // Don't render if multi-facility is disabled or only one facility
  if (!isMultiFacilityEnabled || facilities.length <= 1) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex items-center space-x-2 px-3 py-2 bg-accent/50 rounded-lg">
        <Factory className="w-4 h-4 text-brand-neutral animate-pulse" />
        <span className="text-sm text-brand-neutral">Loading...</span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="flex items-center space-x-2 px-3 py-2 bg-accent/50 hover:bg-accent rounded-lg transition-colors"
          data-testid="facility-switcher-trigger"
        >
          <Building className="w-4 h-4 text-brand-primary" />
          <span className="text-sm font-medium text-brand-primary max-w-32 truncate">
            {currentFacility?.name || 'Select Facility'}
          </span>
          <ChevronDown className="w-3 h-3 text-brand-neutral" />
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        {facilities.map((facility) => (
          <DropdownMenuItem
            key={facility.id}
            onClick={() => handleFacilityChange(facility)}
            className={`flex items-start space-x-3 p-3 cursor-pointer ${
              currentFacility?.id === facility.id ? 'bg-accent' : ''
            }`}
            data-testid={`facility-option-${facility.id}`}
          >
            <Factory className={`w-4 h-4 mt-0.5 ${
              currentFacility?.id === facility.id ? 'text-brand-primary' : 'text-brand-neutral'
            }`} />
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm truncate ${
                currentFacility?.id === facility.id ? 'text-brand-primary' : 'text-foreground'
              }`}>
                {facility.name}
                {facility.isPrimary && (
                  <span className="ml-2 px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-xs rounded-full">
                    Primary
                  </span>
                )}
              </div>
              <div className="text-xs text-brand-neutral truncate">
                {facility.address}, {facility.city}, {facility.state}
              </div>
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

