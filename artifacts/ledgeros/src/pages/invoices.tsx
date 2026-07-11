import { useListInvoices } from "@workspace/api-client-react";
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

export default function Invoices() {
  const { data: invoices, isLoading } = useListInvoices();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'submitted': return <Badge variant="secondary">Submitted</Badge>;
      case 'approved': return <Badge variant="default" className="bg-blue-600">Approved</Badge>;
      case 'sent': return <Badge variant="default" className="bg-indigo-600">Sent</Badge>;
      case 'paid': return <Badge variant="default" className="bg-green-600">Paid</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices (AR)</h1>
          <p className="text-muted-foreground">Manage customer invoices and accounts receivable.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Invoice
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Number</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Issue Date</TableHead>
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
            ) : invoices?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No invoices found.</TableCell>
              </TableRow>
            ) : (
              invoices?.map((invoice) => (
                <TableRow key={invoice.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-medium">
                    {invoice.number}
                    {invoice.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                  </TableCell>
                  <TableCell>{invoice.customerName || `Customer #${invoice.customerId}`}</TableCell>
                  <TableCell>{new Date(invoice.issueDate).toLocaleDateString()}</TableCell>
                  <TableCell>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(invoice.total)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(invoice.amountPaid || 0)}</TableCell>
                  <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
