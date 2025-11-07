import { Switch, Route } from "wouter";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { FeatureFlagProvider } from "@/contexts/FeatureFlagContext";
import { FacilityProvider } from "@/contexts/FacilityContext";
import { ClientContextProvider } from "@/contexts/ClientContext";
import { queryClient } from "@/lib/queryClient";
import ErrorBoundary from "@/components/ErrorBoundary";
import ProtectedRoute from "@/components/ProtectedRoute";
import SetupGate from "@/components/SetupGate";
import AppLayout from "@/components/layout/AppLayout";
import { lazy } from "react"; // Import lazy

// Pages
import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import RegisterComplete from "@/pages/RegisterComplete";
import RegisterEmailSent from "@/pages/RegisterEmailSent";
import VerifyEmail from '@/pages/VerifyEmail';
import AccountTypeSelection from '@/pages/AccountTypeSelection';
import Pricing from '@/pages/Pricing';
import Dashboard from "@/pages/Dashboard";
import NewAssessment from "@/pages/NewAssessment";
import AssessmentDetail from "@/pages/AssessmentDetail";
import IntakeForm from "@/pages/IntakeForm";
import OnboardingWizard from "@/pages/OnboardingWizard";
import OnboardingV2 from "@/pages/OnboardingV2";
import TestSetup from "@/pages/TestSetup";
import About from "@/pages/About";
import Help from "@/pages/Help";
import Settings from "@/pages/Settings";
import Licenses from "@/pages/Licenses";
import LicenseSuccess from "@/pages/LicenseSuccess";
import ClientOrganizations from "@/pages/ClientOrganizations";
import ClientFacilities from "@/pages/ClientFacilities";
import Clients from "./pages/Clients";
import ClientDetail from "./pages/ClientDetail";
import Facilities from "./pages/Facilities"; // Import Facilities component
import IntakeFacilities from "./pages/IntakeFacilities"; // Import IntakeFacilities component
import FacilityUserManagement from './pages/FacilityUserManagement'; // Import FacilityUserManagement component
import Setup2FA from "@/pages/Setup2FA";
import Verify2FA from "@/pages/Verify2FA";
import AccountSecurity from "@/pages/AccountSecurity";
import NotFound from "@/pages/not-found";
import TrainingCenter from './pages/TrainingCenter';
import ConsultantDashboard from './pages/ConsultantDashboard';
import AnalyticsDashboard from './pages/AnalyticsDashboard';
import CalendarPage from './pages/CalendarPage';
import CloudStorageManager from './pages/CloudStorageManager';
import RBACAdmin from './pages/RBACAdmin';
import TeamManagement from './pages/TeamManagement';
import Reports from './pages/Reports';
import BrandSettings from './pages/BrandSettings';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('App Error Boundary caught:', error, errorInfo);
        // Log additional context for external browser debugging
        console.error('User Agent:', navigator.userAgent);
        console.error('URL:', window.location.href);
        console.error('Timestamp:', new Date().toISOString());
      }}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <AuthProvider>
            <FeatureFlagProvider>
              <FacilityProvider>
                <ClientContextProvider>
          <Switch>
            {/* Public Routes */}
            <Route path="/" component={Landing} />
            <Route path="/login" component={Login} />
            <Route path="/register" component={Register} />
            <Route path="/register/complete" component={RegisterComplete} />
            <Route path="/register/email-sent" component={RegisterEmailSent} />
            <Route path="/verify-email" component={VerifyEmail} />
            <Route path="/forgot-password" component={lazy(() => import("@/pages/ForgotPassword"))} />
            <Route path="/reset-password" component={lazy(() => import("@/pages/ResetPassword"))} />

            {/* 2FA Routes */}
            <Route path="/setup-2fa" component={() => (
              <ProtectedRoute>
                <Setup2FA />
                <Toaster />
              </ProtectedRoute>
            )} />

            <Route path="/verify-2fa" component={() => (
              <Verify2FA />
            )} />

            {/* Setup Flow Routes - Require auth but not full setup */}
            <Route path="/account-type-selection" component={() => (
              <ProtectedRoute>
                <AccountTypeSelection />
                <Toaster />
              </ProtectedRoute>
            )} />

            <Route path="/pricing" component={() => (
              <ProtectedRoute>
                <Pricing />
                <Toaster />
              </ProtectedRoute>
            )} />

            {/* Protected Routes */}
            <Route path="/dashboard" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Dashboard />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/onboarding" component={() => (
              <ProtectedRoute>
                <OnboardingWizard />
                <Toaster />
              </ProtectedRoute>
            )} />

            <Route path="/onboarding-v2" component={() => (
              <ProtectedRoute>
                <OnboardingV2 />
                <Toaster />
              </ProtectedRoute>
            )} />

            <Route path="/test-setup" component={() => (
              <TestSetup />
            )} />

            <Route path="/intake-form" component={() => (
              <ProtectedRoute>
                <AppLayout>
                  <IntakeForm />
                  <Toaster />
                </AppLayout>
              </ProtectedRoute>
            )} />

            <Route path="/assessments">
              {() => (
                <ProtectedRoute>
                  <SetupGate>
                    <AppLayout>
                      <Dashboard />
                      <Toaster />
                    </AppLayout>
                  </SetupGate>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/assessments/new">
              <ProtectedRoute>
                <SetupGate>
                  <NewAssessment />
                  <Toaster />
                </SetupGate>
              </ProtectedRoute>
            </Route>

            <Route path="/new-assessment" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <NewAssessment />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/assessments/:id">
              {(params) => (
                <ProtectedRoute>
                  <SetupGate>
                    <AppLayout>
                      <AssessmentDetail />
                      <Toaster />
                    </AppLayout>
                  </SetupGate>
                </ProtectedRoute>
              )}
            </Route>

            <Route path="/settings" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Settings />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/security" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <AccountSecurity />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/licenses" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Licenses />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/licenses/success" component={() => (
              <ProtectedRoute>
                <LicenseSuccess />
                <Toaster />
              </ProtectedRoute>
            )} />

            <Route path="/facilities" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Facilities />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/facilities/:id/users" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <FacilityUserManagement />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/intake-facilities/:intakeFormId" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <IntakeFacilities />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/team" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <TeamManagement />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/reports" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Reports />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/clients" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <Clients />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/clients/:id" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <ClientDetail />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/client-organizations" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <ClientOrganizations />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/client-facilities" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <ClientFacilities />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/brand-settings" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <BrandSettings />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/training-center" component={TrainingCenter} />
            <Route path="/consultant-dashboard" component={ConsultantDashboard} />
            <Route path="/analytics-dashboard" component={AnalyticsDashboard} />

            <Route path="/calendar" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <CalendarPage />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/cloud-storage" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <CloudStorageManager />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            <Route path="/admin/rbac" component={() => (
              <ProtectedRoute>
                <SetupGate>
                  <AppLayout>
                    <RBACAdmin />
                    <Toaster />
                  </AppLayout>
                </SetupGate>
              </ProtectedRoute>
            )} />

            {/* 404 Route */}
            <Route component={NotFound} />
          </Switch>
                </ClientContextProvider>
            </FacilityProvider>
            </FeatureFlagProvider>
          </AuthProvider>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;