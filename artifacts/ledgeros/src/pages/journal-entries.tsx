import { useListJournalEntries } from "@workspace/api-client-react";
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

export default function JournalEntries() {
  const { data: entries, isLoading } = useListJournalEntries();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'draft': return <Badge variant="outline">Draft</Badge>;
      case 'submitted': return <Badge variant="secondary">Submitted</Badge>;
      case 'posted': return <Badge variant="default" className="bg-green-600 hover:bg-green-700">Posted</Badge>;
      case 'reversed': return <Badge variant="destructive">Reversed</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Journal Entries</h1>
          <p className="text-muted-foreground">Manage double-entry manual journal records.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Ref</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : entries?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No journal entries found.</TableCell>
              </TableRow>
            ) : (
              entries?.map((entry) => (
                <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>{new Date(entry.entryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-mono text-xs">{entry.reference || `JE-${entry.id}`}</TableCell>
                  <TableCell>
                    {entry.memo}
                    {entry.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                  </TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(entry.totalDebit)}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(entry.totalCredit)}</TableCell>
                  <TableCell>{getStatusBadge(entry.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
