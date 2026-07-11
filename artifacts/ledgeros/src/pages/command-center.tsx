import { useGetCommandCenterSummary } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Target, Activity } from "lucide-react";

export default function CommandCenter() {
  const { data: summary, isLoading, error } = useGetCommandCenterSummary();

  if (isLoading) {
    return <div className="space-y-4">
      <div className="h-8 w-64 bg-muted animate-pulse rounded"></div>
      <div className="grid gap-4 md:grid-cols-3">
        {[1,2,3].map(i => <div key={i} className="h-32 bg-muted animate-pulse rounded-xl"></div>)}
      </div>
    </div>;
  }

  if (error || !summary) {
    return <div className="p-4 bg-destructive/10 text-destructive rounded-lg">Failed to load command center data.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command Center</h1>
          <p className="text-muted-foreground">High-level operations read-only overview.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          Last updated: {new Date(summary.generatedAt).toLocaleTimeString()}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="bg-slate-900 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Cash Position</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{formatCurrency(summary.cashPosition)}</div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-900 text-white">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Pending Approvals</CardTitle>
            <Target className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{summary.pendingApprovals || 0}</div>
          </CardContent>
        </Card>

        <Card className="bg-slate-900 text-white border-destructive/50">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-300">Action Required</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-destructive">
              {(summary.overdueInvoicesCount || 0) + (summary.integrationErrors || 0)}
            </div>
            <div className="text-sm text-slate-400 mt-1 flex gap-2">
              <span>{summary.overdueInvoicesCount || 0} overdue AR</span>
              <span>•</span>
              <span>{summary.integrationErrors || 0} sync errors</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
