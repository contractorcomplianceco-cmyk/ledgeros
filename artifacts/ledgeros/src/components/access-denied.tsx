import { ShieldAlert } from "lucide-react";

export function AccessDenied({ detail }: { detail?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <ShieldAlert className="h-7 w-7 text-destructive" />
      </div>
      <h1 className="text-2xl font-bold tracking-tight">Access restricted</h1>
      <p className="text-muted-foreground mt-2 max-w-md">
        {detail ??
          "Your role does not have permission to view this page. Contact your accounting lead or owner if you believe this is an error."}
      </p>
    </div>
  );
}
