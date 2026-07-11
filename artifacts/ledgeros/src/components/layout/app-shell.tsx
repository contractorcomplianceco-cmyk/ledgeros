import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { useGetSession, useLogout } from "@workspace/api-client-react";
import { 
  LayoutDashboard, 
  Landmark, 
  FileText, 
  Users, 
  Briefcase, 
  Receipt,
  CreditCard,
  Wallet,
  Settings,
  ShieldCheck,
  LogOut,
  Activity,
  Inbox,
  CheckSquare,
  BarChart,
  ListTodo
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, permission: "dashboard.view" },
  { href: "/approvals", label: "Approvals", icon: CheckSquare, permission: "approvals.view" },
  { href: "/banking", label: "Banking", icon: Landmark, permission: "banking.view" },
  { href: "/accounts", label: "Chart of Accounts", icon: ListTodo, permission: "accounts.view" },
  { href: "/journal-entries", label: "Journal Entries", icon: FileText, permission: "journal.view" },
  { href: "/invoices", label: "Invoices (AR)", icon: Receipt, permission: "invoices.view" },
  { href: "/bills", label: "Bills (AP)", icon: CreditCard, permission: "bills.view" },
  { href: "/expenses", label: "Expenses", icon: Wallet, permission: "expenses.view" },
  { href: "/customers", label: "Customers", icon: Users, permission: "customers.view" },
  { href: "/vendors", label: "Vendors", icon: Briefcase, permission: "vendors.view" },
  { href: "/reports", label: "Reports", icon: BarChart, permission: "reports.view" },
  { href: "/integration-inbox", label: "Inbox", icon: Inbox, permission: "integrations.view" },
  { href: "/audit-log", label: "Audit Log", icon: Activity, permission: "audit.view" },
  { href: "/settings", label: "Settings", icon: Settings, permission: "settings.view" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: session, isLoading } = useGetSession();
  const logout = useLogout();
  const queryClient = useQueryClient();

  if (isLoading) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }

  if (!session?.authenticated) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSuccess: () => {
        queryClient.clear();
        window.location.href = "/login";
      }
    });
  };

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <aside className="w-64 border-r bg-sidebar flex flex-col hidden md:flex">
        <div className="h-14 flex items-center px-6 border-b font-semibold text-lg flex-shrink-0">
          <ShieldCheck className="mr-2 h-5 w-5 text-primary" />
          LedgerOS
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV_ITEMS.filter(
            (item) => (session.permissions ?? []).includes(item.permission),
          ).map((item) => (
            <Link key={item.href} href={item.href}>
              <div className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer",
                location === item.href 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </div>
            </Link>
          ))}
        </div>
        <div className="p-4 border-t flex-shrink-0">
          <div className="mb-4 px-2">
            <div className="font-medium text-sm truncate">{session.user?.name}</div>
            <div className="text-xs text-muted-foreground truncate">{session.user?.role}</div>
          </div>
          <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </aside>
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 md:hidden">
           <span className="font-semibold">LedgerOS</span>
        </header>
        <div className="flex-1 overflow-auto p-6 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
