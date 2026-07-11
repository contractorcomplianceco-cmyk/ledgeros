import { useGetDashboard } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/utils";
import { DollarSign, AlertCircle, Clock, CheckSquare } from "lucide-react";

export default function Dashboard() {
  const { data: dashboard, isLoading, error } = useGetDashboard();

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>)}
      </div>
    </div>;
  }

  if (error || !dashboard) {
    return <div className="p-4 bg-destructive/10 text-destructive rounded-lg">Failed to load dashboard data.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Position</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.cashPosition)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.overdueInvoicesAmount || 0)}</div>
            <p className="text-xs text-muted-foreground">
              {dashboard.overdueInvoicesCount || 0} invoices
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Approvals</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.pendingApprovals || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AR Total</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboard.arTotal || 0)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Bank Balances</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.bankBalances?.map(account => (
                <div key={account.id} className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{account.label}</div>
                    <div className="text-sm text-muted-foreground">{account.institution} •••• {account.maskedNumber}</div>
                  </div>
                  <div className="font-bold">{formatCurrency(account.balance)}</div>
                </div>
              ))}
              {!dashboard.bankBalances?.length && (
                <div className="text-sm text-muted-foreground py-4 text-center">No connected bank accounts</div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {dashboard.recentActivity?.map(log => (
                <div key={log.id} className="flex flex-col border-b last:border-0 pb-3 last:pb-0">
                  <div className="flex justify-between items-start">
                    <span className="font-medium text-sm">{log.action} {log.recordType}</span>
                    <span className="text-xs text-muted-foreground">{new Date(log.timestamp).toLocaleDateString()}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">by {log.userName || 'System'}</span>
                </div>
              ))}
              {!dashboard.recentActivity?.length && (
                <div className="text-sm text-muted-foreground py-4 text-center">No recent activity</div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
