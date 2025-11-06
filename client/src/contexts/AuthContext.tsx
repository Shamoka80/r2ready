
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';

interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role?: string;
  setupStatus?: string;
  emailVerified?: boolean;
  tenant?: {
    id: string;
    name: string;
    type: string;
  };
}

interface TwoFactorStatus {
  enabled: boolean;
  qrCodeUrl?: string;
  backupCodesCount?: number;
}

export interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  twoFactorRequired: boolean;
  twoFactorStatus: TwoFactorStatus | null;
  pendingUserEmail: string | null;
  login: (email: string, password: string) => Promise<{ requiresTwoFactor?: boolean }>;
  verifyTwoFactor: (code: string) => Promise<void>;
  register: (
    email: string, 
    password: string, 
    companyName: string,
    firstName?: string,
    lastName?: string,
    accountType?: string
  ) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  getTwoFactorStatus: (explicitToken?: string) => Promise<TwoFactorStatus>;
  setupTwoFactor: (userEmail: string) => Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }>;
  completeTwoFactorSetup: (totpCode: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState(false);
  const [twoFactorStatus, setTwoFactorStatus] = useState<TwoFactorStatus | null>(null);
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUserEmail, setPendingUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        if (token) {
          const response = await fetch('/api/auth/me', {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser({
              id: data.user.id,
              email: data.user.email,
              firstName: data.user.firstName,
              lastName: data.user.lastName,
              role: data.user.role,
              setupStatus: data.user.setupStatus,
              emailVerified: data.user.emailVerified,
              tenant: data.tenant,
            });
            setIsAuthenticated(true);
          } else {
            localStorage.removeItem('auth_token');
          }
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        localStorage.removeItem('auth_token');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  const login = async (email: string, password: string): Promise<{ requiresTwoFactor?: boolean }> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      
      // Store pending user data for 2FA verification
      const userData = {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        setupStatus: data.user.setupStatus,
        emailVerified: data.user.emailVerified,
        tenant: data.tenant,
      };

      // Check if 2FA is required for this user (consultant accounts)
      const isConsultant = data.user.role && (
        data.user.role.includes('consultant') || 
        data.tenant?.type === 'CONSULTANT'
      );
      
      if (isConsultant) {
        // Check 2FA status using the fresh token
        const twoFactorStatus = await getTwoFactorStatus(data.token);
        
        if (!twoFactorStatus.enabled) {
          // 2FA setup required
          setUser(userData);
          setIsAuthenticated(true);
          localStorage.setItem('auth_token', data.token);
          return { requiresTwoFactor: false }; // Will be handled by setup enforcement
        } else {
          // 2FA verification required
          setPendingToken(data.token);
          setPendingUserEmail(data.user.email);
          setTwoFactorRequired(true);
          return { requiresTwoFactor: true };
        }
      } else {
        // Regular login for non-consultant users
        setUser(userData);
        setIsAuthenticated(true);
        localStorage.setItem('auth_token', data.token);
        return { requiresTwoFactor: false };
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string, 
    password: string, 
    companyName: string,
    firstName?: string,
    lastName?: string,
    accountType?: string
  ): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/register-tenant', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenantName: companyName,
          tenantType: accountType === 'consultant' ? 'CONSULTANT' : 'BUSINESS',
          ownerEmail: email,
          ownerFirstName: firstName || email.split('@')[0] || 'User',
          ownerLastName: lastName || 'User',
          ownerPassword: password,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      
      setUser({
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.firstName,
        lastName: data.user.lastName,
        role: data.user.role,
        setupStatus: data.user.setupStatus,
        emailVerified: data.user.emailVerified,
        tenant: data.tenant,
      });
      setIsAuthenticated(true);
      localStorage.setItem('auth_token', data.token);
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        const response = await fetch('/api/auth/me', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          setUser({
            id: data.user.id,
            email: data.user.email,
            firstName: data.user.firstName,
            lastName: data.user.lastName,
            role: data.user.role,
            setupStatus: data.user.setupStatus,
            emailVerified: data.user.emailVerified,
            tenant: data.tenant,
          });
        }
      }
    } catch (error) {
      console.error('User refresh error:', error);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setTwoFactorRequired(false);
      setPendingToken(null);
      setPendingUserEmail(null);
      localStorage.removeItem('auth_token');
    }
  };

  const getTwoFactorStatus = useCallback(async (explicitToken?: string): Promise<TwoFactorStatus> => {
    try {
      const token = explicitToken || localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/2fa/status', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get 2FA status');
      }

      const data = await response.json();
      const status = {
        enabled: data.data?.enabled || false,
        backupCodesCount: data.data?.backupCodesCount || 0,
      };
      setTwoFactorStatus(status);
      return status;
    } catch (error) {
      console.error('2FA status error:', error);
      const defaultStatus = { enabled: false };
      setTwoFactorStatus(defaultStatus);
      return defaultStatus;
    }
  }, []);

  const verifyTwoFactor = async (code: string): Promise<void> => {
    try {
      const token = pendingToken || localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token available');
      }

      const response = await fetch('/api/auth/2fa/verify', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || '2FA verification failed');
      }

      // If verification successful, complete the login
      if (pendingToken) {
        localStorage.setItem('auth_token', pendingToken);
        setPendingToken(null);
      }
      setTwoFactorRequired(false);
      setIsAuthenticated(true);
      
      // Refresh user data
      await refreshUser();
    } catch (error) {
      console.error('2FA verification error:', error);
      throw error;
    }
  };

  const setupTwoFactor = async (userEmail: string): Promise<{ secret: string; qrCodeUrl: string; backupCodes: string[] }> => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/2fa/setup/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userEmail }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to setup 2FA');
      }

      const data = await response.json();
      return data.data;
    } catch (error) {
      console.error('2FA setup error:', error);
      throw error;
    }
  };

  const completeTwoFactorSetup = async (totpCode: string): Promise<void> => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch('/api/auth/2fa/setup/complete', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ totpCode }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to complete 2FA setup');
      }

      // Refresh 2FA status
      await getTwoFactorStatus();
    } catch (error) {
      console.error('2FA setup completion error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    twoFactorRequired,
    twoFactorStatus,
    pendingUserEmail,
    login,
    verifyTwoFactor,
    logout,
    register,
    refreshUser,
    getTwoFactorStatus,
    setupTwoFactor,
    completeTwoFactorSetup,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
