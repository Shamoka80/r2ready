import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useFeatureFlag } from '@/lib/flags';

interface Facility {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  isPrimary: boolean;
  isActive: boolean;
  operatingStatus: 'ACTIVE' | 'INACTIVE' | 'MAINTENANCE' | 'SUSPENDED';
}

interface FacilityContextType {
  currentFacility: Facility | null;
  setCurrentFacility: (facility: Facility | null) => void;
  facilities: Facility[];
  isLoading: boolean;
  isMultiFacilityEnabled: boolean;
}

const FacilityContext = createContext<FacilityContextType | undefined>(undefined);

// Session storage key for current facility
const CURRENT_FACILITY_KEY = 'currentFacilityId';

export function FacilityProvider({ children }: { children: ReactNode }) {
  const isMultiFacilityEnabled = useFeatureFlag('multi_facility');
  const [currentFacility, setCurrentFacilityState] = useState<Facility | null>(null);

  // Fetch available facilities
  const { data: facilities = [], isLoading } = useQuery<Facility[]>({
    queryKey: ['/api/facilities'],
    enabled: isMultiFacilityEnabled,
  });

  // Initialize current facility from session storage or default to primary
  useEffect(() => {
    if (facilities.length > 0 && !currentFacility) {
      const savedFacilityId = sessionStorage.getItem(CURRENT_FACILITY_KEY);
      let facilityToSet = null;

      if (savedFacilityId) {
        facilityToSet = facilities.find(f => f.id === savedFacilityId);
      }
      
      // Fallback to primary facility or first facility
      if (!facilityToSet) {
        facilityToSet = facilities.find(f => f.isPrimary) || facilities[0];
      }

      if (facilityToSet) {
        setCurrentFacilityState(facilityToSet);
        sessionStorage.setItem(CURRENT_FACILITY_KEY, facilityToSet.id);
      }
    }
  }, [facilities, currentFacility]);

  const setCurrentFacility = (facility: Facility | null) => {
    setCurrentFacilityState(facility);
    if (facility) {
      sessionStorage.setItem(CURRENT_FACILITY_KEY, facility.id);
    } else {
      sessionStorage.removeItem(CURRENT_FACILITY_KEY);
    }
  };

  const contextValue: FacilityContextType = {
    currentFacility,
    setCurrentFacility,
    facilities,
    isLoading,
    isMultiFacilityEnabled,
  };

  return (
    <FacilityContext.Provider value={contextValue}>
      {children}
    </FacilityContext.Provider>
  );
}

export function useFacilityContext(): FacilityContextType {
  const context = useContext(FacilityContext);
  if (context === undefined) {
    throw new Error('useFacilityContext must be used within a FacilityProvider');
  }
  return context;
}

// Hook to get current facility ID for API requests
export function useCurrentFacilityId(): string | null {
  const { currentFacility, isMultiFacilityEnabled } = useFacilityContext();
  return isMultiFacilityEnabled ? currentFacility?.id || null : null;
}