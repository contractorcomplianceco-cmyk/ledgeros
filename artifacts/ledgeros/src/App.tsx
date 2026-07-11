import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useGetSession } from "@workspace/api-client-react";
import NotFound from "@/pages/not-found";

import { AppShell } from "@/components/layout/app-shell";
import { AccessDenied } from "@/components/access-denied";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Accounts from "@/pages/accounts";
import Approvals from "@/pages/approvals";
import JournalEntries from "@/pages/journal-entries";
import Customers from "@/pages/customers";
import Vendors from "@/pages/vendors";
import Invoices from "@/pages/invoices";
import Bills from "@/pages/bills";
import Banking from "@/pages/banking";
import Expenses from "@/pages/expenses";
import Reports from "@/pages/reports";
import Reconciliations from "@/pages/reconciliation";
import Ledger from "@/pages/ledger";
import Payments from "@/pages/payments";
import Payroll from "@/pages/payroll";
import MonthlyClose from "@/pages/monthly-close";
import IntegrationInbox from "@/pages/integration-inbox";
import ProductMappings from "@/pages/product-mappings";
import CommandCenter from "@/pages/command-center";
import AuditLog from "@/pages/audit-log";
import Users from "@/pages/users";
import Settings from "@/pages/settings";
import ProductionReadiness from "@/pages/production-readiness";

const queryClient = new QueryClient();

function ProtectedRoute({
  component: Component,
  permission,
  ...rest
}: any) {
  const { data: session, isLoading } = useGetSession();

  if (isLoading) return <div className="flex h-screen items-center justify-center">Loading...</div>;
  
  if (!session?.authenticated) {
    return <Redirect to="/login" />;
  }

  const permissions = session.permissions ?? [];
  if (permission && !permissions.includes(permission)) {
    return <AccessDenied />;
  }

  return <Component {...rest} />;
}

function Router() {
  const { data: session } = useGetSession();

  return (
    <AppShell>
      <Switch>
        <Route path="/login">
          {session?.authenticated ? <Redirect to="/" /> : <Login />}
        </Route>
        
        <Route path="/">
          <ProtectedRoute component={Dashboard} permission="dashboard.view" />
        </Route>
        <Route path="/accounts">
          <ProtectedRoute component={Accounts} permission="accounts.view" />
        </Route>
        <Route path="/approvals">
          <ProtectedRoute component={Approvals} permission="approvals.view" />
        </Route>
        <Route path="/journal-entries">
          <ProtectedRoute component={JournalEntries} permission="journal.view" />
        </Route>
        <Route path="/customers">
          <ProtectedRoute component={Customers} permission="customers.view" />
        </Route>
        <Route path="/vendors">
          <ProtectedRoute component={Vendors} permission="vendors.view" />
        </Route>
        <Route path="/invoices">
          <ProtectedRoute component={Invoices} permission="invoices.view" />
        </Route>
        <Route path="/bills">
          <ProtectedRoute component={Bills} permission="bills.view" />
        </Route>
        <Route path="/banking">
          <ProtectedRoute component={Banking} permission="banking.view" />
        </Route>
        <Route path="/expenses">
          <ProtectedRoute component={Expenses} permission="expenses.view" />
        </Route>
        <Route path="/reports">
          <ProtectedRoute component={Reports} permission="reports.view" />
        </Route>
        <Route path="/reconciliation">
          <ProtectedRoute component={Reconciliations} permission="banking.view" />
        </Route>
        <Route path="/ledger">
          <ProtectedRoute component={Ledger} permission="ledger.view" />
        </Route>
        <Route path="/payments">
          <ProtectedRoute component={Payments} permission="payments.view" />
        </Route>
        <Route path="/payroll">
          <ProtectedRoute component={Payroll} permission="payroll.view" />
        </Route>
        <Route path="/monthly-close">
          <ProtectedRoute component={MonthlyClose} permission="close.view" />
        </Route>
        <Route path="/integration-inbox">
          <ProtectedRoute component={IntegrationInbox} permission="integrations.view" />
        </Route>
        <Route path="/product-mappings">
          <ProtectedRoute component={ProductMappings} permission="integrations.view" />
        </Route>
        <Route path="/command-center">
          <ProtectedRoute component={CommandCenter} permission="dashboard.view" />
        </Route>
        <Route path="/audit-log">
          <ProtectedRoute component={AuditLog} permission="audit.view" />
        </Route>
        <Route path="/users">
          <ProtectedRoute component={Users} permission="users.manage" />
        </Route>
        <Route path="/settings">
          <ProtectedRoute component={Settings} permission="settings.view" />
        </Route>
        <Route path="/production-readiness">
          <ProtectedRoute component={ProductionReadiness} permission="readiness.view" />
        </Route>
        
        <Route component={NotFound} />
      </Switch>
    </AppShell>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
