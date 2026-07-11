import { useListIntegrationEvents } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function IntegrationInbox() {
  const { data: events, isLoading } = useListIntegrationEvents();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'pending': return <Badge variant="secondary">Pending</Badge>;
      case 'processed': return <Badge variant="default" className="bg-green-600">Processed</Badge>;
      case 'dismissed': return <Badge variant="outline">Dismissed</Badge>;
      case 'error': return <Badge variant="destructive">Error</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integration Inbox</h1>
          <p className="text-muted-foreground">Review incoming events from external systems.</p>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Received</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Summary</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : events?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No events found.</TableCell>
              </TableRow>
            ) : (
              events?.map((event) => (
                <TableRow key={event.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="text-sm">{new Date(event.receivedAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{event.sourceApp}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{event.eventType}</TableCell>
                  <TableCell className="text-muted-foreground truncate max-w-[200px]">{event.summary || "-"}</TableCell>
                  <TableCell className="text-right font-medium">
                    {event.amount != null ? formatCurrency(event.amount) : "-"}
                  </TableCell>
                  <TableCell>{getStatusBadge(event.status)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
