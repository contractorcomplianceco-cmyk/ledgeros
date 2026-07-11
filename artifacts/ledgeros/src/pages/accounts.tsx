import { useState } from "react";
import { useListAccounts, useCreateAccount } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Search } from "lucide-react";

export default function Accounts() {
  const { data: accounts, isLoading } = useListAccounts();
  const [search, setSearch] = useState("");

  const filteredAccounts = accounts?.filter(account => 
    account.name.toLowerCase().includes(search.toLowerCase()) || 
    account.code.toLowerCase().includes(search.toLowerCase()) ||
    account.type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your general ledger accounts.</p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Account
        </Button>
      </div>

      <div className="flex items-center space-x-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search accounts..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Subtype</TableHead>
              <TableHead className="text-right">Balance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center">Loading...</TableCell>
              </TableRow>
            ) : filteredAccounts?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">No accounts found.</TableCell>
              </TableRow>
            ) : (
              filteredAccounts?.map((account) => (
                <TableRow key={account.id} className="cursor-pointer hover:bg-muted/50">
                  <TableCell className="font-mono text-xs">{account.code}</TableCell>
                  <TableCell className="font-medium">
                    {account.name}
                    {account.isSensitive && <span className="ml-2 text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">Sensitive</span>}
                  </TableCell>
                  <TableCell className="capitalize">{account.type}</TableCell>
                  <TableCell className="text-muted-foreground">{account.subtype || "-"}</TableCell>
                  <TableCell className="text-right font-medium">{formatCurrency(account.balance)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
