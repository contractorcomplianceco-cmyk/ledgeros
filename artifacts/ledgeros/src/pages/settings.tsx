import { useGetSettings } from "@workspace/api-client-react";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { data: settings, isLoading } = useGetSettings();

  if (isLoading) {
    return <div className="p-4">Loading settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage company preferences and system thresholds.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Company Details</CardTitle>
          <CardDescription>Official business information for reporting.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input id="companyName" defaultValue={settings?.companyName} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="legalName">Legal Name</Label>
              <Input id="legalName" defaultValue={settings?.legalName || ""} readOnly />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="baseCurrency">Base Currency</Label>
              <Input id="baseCurrency" defaultValue={settings?.baseCurrency} readOnly />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fiscalYearStart">Fiscal Year Start</Label>
              <Input id="fiscalYearStart" defaultValue={settings?.fiscalYearStart || ""} readOnly />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thresholds & Limits</CardTitle>
          <CardDescription>Rules requiring secondary review or special handling.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="approvalThreshold">Approval Required Threshold</Label>
              <Input 
                id="approvalThreshold" 
                defaultValue={settings?.approvalThreshold ? settings.approvalThreshold.toString() : ""} 
                readOnly 
              />
              <p className="text-xs text-muted-foreground">
                Transactions above {formatCurrency(settings?.approvalThreshold || 0)} require review.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="highValueThreshold">High Value Threshold</Label>
              <Input 
                id="highValueThreshold" 
                defaultValue={settings?.highValueThreshold ? settings.highValueThreshold.toString() : ""} 
                readOnly 
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
          <CardDescription>Technical system details.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Rollout Stage</Label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm bg-muted px-2 py-1 rounded">{settings?.rolloutStage || "unknown"}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button disabled>Save Changes</Button>
      </div>
    </div>
  );
}
