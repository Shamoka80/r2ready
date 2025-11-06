import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const STORAGE_KEY = 'rur2_selected_client';

interface ClientContextValue {
  selectedClientId: string | null;
  setSelectedClient: (id: string | null) => void;
  clearSelectedClient: () => void;
  getSelectedClient: () => string | null;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export function ClientContextProvider({ children }: { children: ReactNode }) {
  const [selectedClientId, setSelectedClientIdState] = useState<string | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? stored : null;
    } catch (error) {
      console.error('Error loading client context from localStorage:', error);
      return null;
    }
  });

  const setSelectedClient = (id: string | null) => {
    try {
      if (id) {
        localStorage.setItem(STORAGE_KEY, id);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
      setSelectedClientIdState(id);
    } catch (error) {
      console.error('Error saving client context to localStorage:', error);
    }
  };

  const clearSelectedClient = () => {
    setSelectedClient(null);
  };

  const getSelectedClient = () => {
    return selectedClientId;
  };

  const value: ClientContextValue = {
    selectedClientId,
    setSelectedClient,
    clearSelectedClient,
    getSelectedClient,
  };

  return (
    <ClientContext.Provider value={value}>
      {children}
    </ClientContext.Provider>
  );
}

export function useClientContext() {
  const context = useContext(ClientContext);
  if (context === undefined) {
    throw new Error('useClientContext must be used within a ClientContextProvider');
  }
  return context;
}
