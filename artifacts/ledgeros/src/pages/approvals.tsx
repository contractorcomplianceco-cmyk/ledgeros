import { useListApprovals } from "@workspace/api-client-react";
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
import { Link } from "wouter";

export default function Approvals() {
  const { data: approvals, isLoading } = useListApprovals();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Queue</h1>
          <p className="text-muted-foreground">Review and approve pending records across the system.</p>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Type</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Submitted By</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : approvals?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No pending approvals.</TableCell>
              </TableRow>
            ) : (
              approvals?.map((item) => (
                <TableRow key={`${item.recordType}-${item.recordId}`} className="hover:bg-muted/50">
                  <TableCell className="capitalize font-medium">{item.recordType}</TableCell>
                  <TableCell>
                    <Link href={`/${item.recordType}s/${item.recordId}`} className="text-primary hover:underline">
                      {item.title}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{formatCurrency(item.amount)}</TableCell>
                  <TableCell>{item.submittedBy || 'System'}</TableCell>
                  <TableCell>{new Date(item.submittedAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {item.status || 'Pending'}
                    </Badge>
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
