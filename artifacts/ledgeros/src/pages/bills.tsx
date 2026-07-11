import { useListBills } from "@workspace/api-client-react";
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

export default function Bills() {
  const { data: bills, isLoading } = useListBills();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'submitted': return <Badge variant="secondary">Submitted</Badge>;
      case 'approved': return <Badge variant="default" className="bg-blue-600">Approved</Badge>;
      case 'paid': return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Bills (AP)</h1>
          <p className="text-muted-foreground">Manage vendor bills and accounts payable.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Bill
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Vendor</TableHead>
              <TableHead>Bill Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : bills?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No bills found.</TableCell>
              </TableRow>
            ) : (
              bills?.map((bill) => (
                <TableRow key={bill.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {bill.number}
                    {bill.isSensitive && <span className="ml-2 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Sensitive</span>}
                    {bill.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                  </TableCell>
                  <TableCell>{bill.vendorName || `Vendor #${bill.vendorId}`}</TableCell>
                  <TableCell>{new Date(bill.billDate).toLocaleDateString()}</TableCell>
                  <TableCell>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(bill.total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(bill.amountPaid || 0)}</TableCell>
                  <TableCell>{getStatusBadge(bill.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
