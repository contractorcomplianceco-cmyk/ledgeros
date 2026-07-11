import { useListReconciliations } from "@workspace/api-client-react";
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

export default function Reconciliations() {
  const { data: reconciliations, isLoading } = useListReconciliations();

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
          <h1 className="text-3xl font-bold tracking-tight">Reconciliations</h1>
          <p className="text-muted-foreground">Manage bank account reconciliations.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Start Reconciliation
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Period</TableHead>
              <TableHead className="text-right">Starting</TableHead>
              <TableHead className="text-right">Ending</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : reconciliations?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No reconciliations found.</TableCell>
              </TableRow>
            ) : (
              reconciliations?.map((rec) => (
                <TableRow key={rec.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {rec.bankAccountLabel || `Account #${rec.bankAccountId}`}
                    {rec.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                  </TableCell>
                  <TableCell>
                    {new Date(rec.periodStart).toLocaleDateString()} - {new Date(rec.periodEnd).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(rec.startingBalance)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(rec.endingBalance)}</TableCell>
                  <TableCell className="text-right font-medium">
                    <span className={rec.variance !== 0 ? "text-destructive" : "text-green-600"}>
                      {formatCurrency(rec.variance)}
                    </span>
                  </TableCell>
                  <TableCell>{getStatusBadge(rec.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
