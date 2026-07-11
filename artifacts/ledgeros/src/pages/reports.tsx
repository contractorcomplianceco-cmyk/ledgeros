import { useGetReport } from "@workspace/api-client-react";
import { useState } from "react";
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

export default function Reports() {
  const [reportType, setReportType] = useState<string>("profit-loss");
  const { data: report, isLoading } = useGetReport(reportType, { query: { queryKey: [reportType] } });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground">View and export financial reports.</p>
        </div>
        <div className="w-64">
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger>
              <SelectValue placeholder="Select report" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="profit-loss">Profit & Loss</SelectItem>
              <SelectItem value="balance-sheet">Balance Sheet</SelectItem>
              <SelectItem value="trial-balance">Trial Balance</SelectItem>
              <SelectItem value="ar-aging">AR Aging</SelectItem>
              <SelectItem value="ap-aging">AP Aging</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md bg-card">
        {isLoading ? (
          <div className="h-64 flex items-center justify-center text-muted-foreground">Loading report...</div>
        ) : !report ? (
          <div className="h-64 flex items-center justify-center text-destructive">Failed to load report</div>
        ) : (
          <div className="p-6">
            <h2 className="text-xl font-bold mb-4">{report.title}</h2>
            
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account / Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.rows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className={row.group ? "pl-8" : "font-medium"}>
                      {row.label}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(row.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  );
}
