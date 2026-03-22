import React from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useFirebaseAuth } from "@/hooks/use-firebase-auth";
import { AuthContext } from "@/context/auth-context";
import { RolePreviewProvider } from "@/context/role-preview-context";
import { PermissionsProvider } from "@/context/permissions-context";

import Dashboard from "./pages/dashboard";
import Surveys from "./pages/surveys";
import Customers from "./pages/customers";
import CustomerDetail from "./pages/customer-detail";
import Interactions from "./pages/interactions";
import Campaigns from "./pages/campaigns";
import AuditLogs from "./pages/audit-logs";
import Segments from "./pages/segments";
import Companies from "./pages/companies";
import Analytics from "./pages/analytics";
import Anomalies from "./pages/anomalies";
import SurveyRespond from "./pages/survey-respond";
import SettingsPage from "./pages/settings";
import UserManagementPage from "./pages/user-management";
import ApprovalsPage from "./pages/approvals";
import ManualPage from "./pages/manual";
import TechDocsPage from "./pages/tech-docs";
import PlatformTenantsPage from "./pages/platform-tenants";
import PermissionsPage from "./pages/permissions";
import TagTaxonomyPage from "./pages/tag-taxonomy";
import LoginPage from "./pages/login";
import NotFound from "./pages/not-found";
import { TenantPicker } from "./components/tenant-picker";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/survey/:token" component={SurveyRespond} />
      <Route path="/" component={Dashboard} />
      <Route path="/surveys" component={Surveys} />
      <Route path="/customers" component={Customers} />
      <Route path="/customers/:id" component={CustomerDetail} />
      <Route path="/interactions" component={Interactions} />
      <Route path="/campaigns" component={Campaigns} />
      <Route path="/audit-logs" component={AuditLogs} />
      <Route path="/segments" component={Segments} />
      <Route path="/companies" component={Companies} />
      <Route path="/analytics" component={Analytics} />
      <Route path="/anomalies" component={Anomalies} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/user-management" component={UserManagementPage} />
      <Route path="/approvals" component={ApprovalsPage} />
      <Route path="/manual" component={ManualPage} />
      <Route path="/tech-docs" component={TechDocsPage} />
      <Route path="/platform-tenants" component={PlatformTenantsPage} />
      <Route path="/permissions" component={PermissionsPage} />
      <Route path="/tag-taxonomy" component={TagTaxonomyPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthGate({ children }: { children: React.ReactNode }) {
  const auth = useFirebaseAuth();
  const [location] = useLocation();

  const isPublicPath = location.startsWith("/survey/");
  if (isPublicPath) return <>{children}</>;

  if (auth.isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
          <p className="text-slate-500 text-sm">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAuthenticated: auth.isAuthenticated,
        tenants: auth.tenants,
        currentTenantId: auth.currentTenantId,
        currentTenantRole: auth.currentTenantRole,
        requiresTenantPicker: auth.requiresTenantPicker,
        login: auth.login,
        logout: auth.logout,
        switchTenant: auth.switchTenant,
        refreshSession: auth.refreshSession,
        getIdToken: auth.getIdToken,
      }}
    >
      {!auth.isAuthenticated ? (
        <LoginPage />
      ) : (
        <PermissionsProvider>
          {auth.requiresTenantPicker && (
            <TenantPicker
              tenants={auth.tenants}
              onSelect={auth.switchTenant}
            />
          )}
          {!auth.requiresTenantPicker && children}
        </PermissionsProvider>
      )}
    </AuthContext.Provider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <RolePreviewProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AuthGate>
              <Router />
            </AuthGate>
          </WouterRouter>
        </RolePreviewProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
