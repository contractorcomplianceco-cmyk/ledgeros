import { useListPayroll } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";

export default function Payroll() {
  const { data: payrollRuns, isLoading } = useListPayroll();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'submitted': return <Badge variant="secondary">Submitted</Badge>;
      case 'approved': return <Badge variant="default" className="bg-green-600">Approved</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Payroll</h1>
          <p className="text-muted-foreground">Manage payroll summaries and approvals.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Import Payroll
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Pay Date</TableHead>
              <TableHead>Employees</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Taxes</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : payrollRuns?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No payroll runs found.</TableCell>
              </TableRow>
            ) : (
              payrollRuns?.map((run) => (
                <TableRow key={run.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {new Date(run.periodStart).toLocaleDateString()} - {new Date(run.periodEnd).toLocaleDateString()}
                    {run.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                  </TableCell>
                  <TableCell>{new Date(run.payDate).toLocaleDateString()}</TableCell>
                  <TableCell>{run.employeeCount || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(run.grossPay)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">{formatCurrency(run.taxes || 0)}</TableCell>
                  <TableCell className="text-right font-medium text-primary">{formatCurrency(run.netPay || 0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(run.status)}
                      {run.flagged && <Badge variant="destructive" title={run.flagReason || ""}>Flagged</Badge>}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
