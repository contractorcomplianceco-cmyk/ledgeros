import { useListMonthlyClose } from "@workspace/api-client-react";
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

export default function MonthlyClose() {
  const { data: closePeriods, isLoading } = useListMonthlyClose();

  const getStatusBadge = (status: string) => {
    switch(status.toLowerCase()) {
      case 'open': return <Badge variant="outline">Open</Badge>;
      case 'in_progress': return <Badge variant="secondary">In Progress</Badge>;
      case 'locked': return <Badge variant="default" className="bg-slate-800">Locked</Badge>;
      default: return <Badge>{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monthly Close</h1>
          <p className="text-muted-foreground">Manage period closes and checklists.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Start New Period
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Period</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Checklist Progress</TableHead>
              <TableHead>Locked At</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : closePeriods?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No periods found.</TableCell>
              </TableRow>
            ) : (
              closePeriods?.map((period) => {
                const completedTasks = period.checklist.filter(i => i.done).length;
                const totalTasks = period.checklist.length;
                const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
                
                return (
                  <TableRow key={period.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell className="font-medium font-mono">
                      {period.periodLabel}
                      {period.isTestData && <span className="ml-2 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">Test</span>}
                    </TableCell>
                    <TableCell>
                      {period.periodStart && period.periodEnd ? 
                        `${new Date(period.periodStart).toLocaleDateString()} - ${new Date(period.periodEnd).toLocaleDateString()}` : 
                        "-"
                      }
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 bg-muted rounded overflow-hidden">
                          <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{completedTasks}/{totalTasks}</span>
                      </div>
                    </TableCell>
                    <TableCell>{period.lockedAt ? new Date(period.lockedAt).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>{getStatusBadge(period.status)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
