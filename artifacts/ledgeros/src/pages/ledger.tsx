import { useState } from "react";
import { useGetGeneralLedger, useListAccounts } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Ledger() {
  const [accountId, setAccountId] = useState<number | undefined>(undefined);
  const { data: accounts } = useListAccounts();
  const { data: lines, isLoading } = useGetGeneralLedger({ accountId });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">General Ledger</h1>
          <p className="text-muted-foreground">View all ledger lines, optionally filtered by account.</p>
        </div>
        <div className="w-64">
          <Select 
            value={accountId?.toString()} 
            onValueChange={(val) => setAccountId(val === "all" ? undefined : parseInt(val))}
          >
            <SelectTrigger>
              <SelectValue placeholder="All Accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Accounts</SelectItem>
              {accounts?.map(acc => (
                <SelectItem key={acc.id} value={acc.id.toString()}>
                  {acc.code} - {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : lines?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No ledger lines found.</TableCell>
              </TableRow>
            ) : (
              lines?.map((line) => (
                <TableRow key={line.id} className="hover:bg-muted/50">
                  <TableCell>{new Date(line.entryDate).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">
                    <span className="text-xs text-muted-foreground mr-2">{line.accountCode}</span>
                    {line.accountName}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{line.reference || "-"}</TableCell>
                  <TableCell>{line.memo || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{line.debit > 0 ? formatCurrency(line.debit) : ""}</TableCell>
                  <TableCell className="text-right font-medium">{line.credit > 0 ? formatCurrency(line.credit) : ""}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
