import { useGetProductionReadiness } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertCircle, Clock } from "lucide-react";

export default function ProductionReadiness() {
  const { data: readiness, isLoading } = useGetProductionReadiness();

  if (isLoading) {
    return <div className="p-4">Loading readiness state...</div>;
  }

  const getStatusIcon = (status: string) => {
    switch(status.toLowerCase()) {
      case 'pass': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'fail': return <AlertCircle className="h-5 w-5 text-destructive" />;
      case 'pending': return <Clock className="h-5 w-5 text-muted-foreground" />;
      default: return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Production Readiness</h1>
        <p className="text-muted-foreground">System status for deployment and data migration.</p>
      </div>

      <div className="flex items-center gap-4 p-4 border rounded-lg bg-card">
        <div className="text-lg font-medium">Current Stage:</div>
        <Badge variant="outline" className="text-base px-3 py-1 uppercase tracking-wider">
          {readiness?.rolloutStage || 'UNKNOWN'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Gates</CardTitle>
          <CardDescription>Required checks before advancing to the next stage.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-0 p-0">
          {readiness?.gates?.map((gate, index) => (
            <div key={gate.key} className={`p-4 flex items-start gap-4 ${index !== readiness.gates.length - 1 ? 'border-b' : ''}`}>
              <div className="mt-0.5">
                {getStatusIcon(gate.status)}
              </div>
              <div className="flex-1">
                <div className="font-medium">{gate.name}</div>
                {gate.detail && (
                  <p className="text-sm text-muted-foreground mt-1">{gate.detail}</p>
                )}
              </div>
              <Badge variant={gate.status === 'pass' ? 'default' : gate.status === 'fail' ? 'destructive' : 'secondary'} className="capitalize">
                {gate.status}
              </Badge>
            </div>
          ))}
          {!readiness?.gates?.length && (
             <div className="p-8 text-center text-muted-foreground">No gates defined for this stage.</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
