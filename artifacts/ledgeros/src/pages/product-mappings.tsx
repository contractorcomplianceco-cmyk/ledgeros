import { useListProductMappings } from "@workspace/api-client-react";
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

export default function ProductMappings() {
  const { data: mappings, isLoading } = useListProductMappings();

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Product Mappings</h1>
          <p className="text-muted-foreground">Map source app events to accounting actions and GL accounts.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Mapping
        </Button>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Source App</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Revenue Acc.</TableHead>
              <TableHead>Cost Acc.</TableHead>
              <TableHead>Auto Draft</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : mappings?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">No mappings found.</TableCell>
              </TableRow>
            ) : (
              mappings?.map((mapping) => (
                <TableRow key={mapping.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>
                    <Badge variant="outline" className="font-mono">{mapping.sourceApp}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{mapping.eventType}</TableCell>
                  <TableCell className="capitalize">{mapping.action}</TableCell>
                  <TableCell className="font-mono text-xs">{mapping.revenueAccountId || "-"}</TableCell>
                  <TableCell className="font-mono text-xs">{mapping.costAccountId || "-"}</TableCell>
                  <TableCell>
                    {mapping.autoDraft ? <Badge variant="secondary">Yes</Badge> : <Badge variant="outline">No</Badge>}
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
