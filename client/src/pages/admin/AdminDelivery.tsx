import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Truck, Plus, Trash2, Globe, Shield, Activity } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./AdminLayout";

const apiRequest = async (method: string, url: string, body?: any) => {
  const res = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message || "Request failed");
  return res.json();
};

const emptyRule = {
  minDistanceKm: "0",
  maxDistanceKm: "10",
  baseFee: "30",
  perKmFee: "5",
  maxFeeCap: "150",
  freeDeliveryAboveOrderValue: "500",
  active: true,
};

export default function AdminDelivery() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState<any>(emptyRule);
  const [countryCode, setCountryCode] = useState("");
  const [countryName, setCountryName] = useState("");

  const { data: deliveryData } = useQuery({
    queryKey: ["/api/admin/delivery"],
    queryFn: () => apiRequest("GET", "/api/admin/delivery"),
  });

  const { data: geofenceData } = useQuery({
    queryKey: ["/api/admin/geofence"],
    queryFn: () => apiRequest("GET", "/api/admin/geofence"),
  });

  const { data: logsData } = useQuery({
    queryKey: ["/api/admin/delivery/logs"],
    queryFn: () => apiRequest("GET", "/api/admin/delivery/logs?limit=30"),
  });

  const toggleFeatureMutation = useMutation({
    mutationFn: (enabled: boolean) =>
      apiRequest("POST", "/api/admin/delivery/settings", { featureEnabled: enabled }),
    onSuccess: (_, enabled) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/delivery"] });
      toast({
        title: enabled ? "Delivery Feature Enabled" : "Delivery Feature Disabled",
        description: enabled
          ? "Fee calculation and ETA calculations are active."
          : "Delivery feature disabled; default zero fee active.",
      });
    },
  });

  const saveRuleMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/delivery/fee-rules", data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/delivery"] });
      setRuleDialog(false);
      setRuleForm(emptyRule);
      toast({ title: "Delivery Fee Rule Created" });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/delivery/fee-rules/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/delivery"] });
      toast({ title: "Rule Deleted" });
    },
  });

  const addCountryMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", "/api/admin/geofence", {
        countryCode: countryCode.toUpperCase(),
        countryName: countryName || countryCode.toUpperCase(),
        allowed: true,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/geofence"] });
      setCountryCode("");
      setCountryName("");
      toast({ title: "Country Added to Whitelist" });
    },
  });

  const toggleCountryMutation = useMutation({
    mutationFn: ({ id, allowed }: { id: number; allowed: boolean }) =>
      apiRequest("PATCH", `/api/admin/geofence/${id}`, { allowed }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/geofence"] }),
  });

  const isEnabled = deliveryData?.setting?.featureEnabled ?? false;
  const rules = deliveryData?.rules || [];
  const countries = geofenceData?.countries || [];
  const logs = logsData?.logs || [];

  return (
    <AdminLayout title="Delivery & Geofencing">
      <div className="space-y-6">
        {/* Master Feature Toggle */}
        <Card className={isEnabled ? "border-green-600 bg-green-950/10" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Truck className="w-5 h-5" /> Delivery Engine Status
              </span>
              <div className="flex items-center gap-3">
                <Badge variant={isEnabled ? "default" : "secondary"}>
                  {isEnabled ? "ACTIVE" : "DISABLED"}
                </Badge>
                <Switch
                  checked={isEnabled}
                  onCheckedChange={(val) => toggleFeatureMutation.mutate(val)}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              When enabled, customer locations are checked against registered warehouses, distance rules, and pincodes to calculate accurate ETAs and delivery charges.
            </p>
          </CardContent>
        </Card>

        {/* Distance Fee Rules */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Truck className="w-5 h-5 text-primary" /> Distance Fee Rules
            </CardTitle>
            <Button onClick={() => setRuleDialog(true)} size="sm">
              <Plus className="w-4 h-4 mr-1" /> Add Distance Band Rule
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Min Dist (km)</TableHead>
                  <TableHead>Max Dist (km)</TableHead>
                  <TableHead>Base Fee</TableHead>
                  <TableHead>Per Km Rate</TableHead>
                  <TableHead>Max Fee Cap</TableHead>
                  <TableHead>Free Delivery Above</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No distance rules set yet. Add a rule to enable distance-based pricing.
                    </TableCell>
                  </TableRow>
                ) : (
                  rules.map((r: any) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono">{r.minDistanceKm} km</TableCell>
                      <TableCell className="font-mono">{r.maxDistanceKm} km</TableCell>
                      <TableCell>₹{r.baseFee}</TableCell>
                      <TableCell>₹{r.perKmFee}/km</TableCell>
                      <TableCell>{r.maxFeeCap ? `₹${r.maxFeeCap}` : "No Cap"}</TableCell>
                      <TableCell>{r.freeDeliveryAboveOrderValue ? `₹${r.freeDeliveryAboveOrderValue}` : "N/A"}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteRuleMutation.mutate(r.id)}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Country Geofencing Whitelist */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Globe className="w-5 h-5 text-primary" /> Country Geofencing (IP Whitelist)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Input
                placeholder="ISO Country Code (e.g. IN, US, AE)"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                className="w-48"
              />
              <Input
                placeholder="Country Name (e.g. India)"
                value={countryName}
                onChange={(e) => setCountryName(e.target.value)}
                className="w-64"
              />
              <Button
                onClick={() => addCountryMutation.mutate()}
                disabled={!countryCode || addCountryMutation.isPending}
              >
                <Plus className="w-4 h-4 mr-1" /> Add Country
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Country Code</TableHead>
                  <TableHead>Country Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {countries.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                      No country restrictions. All regions allowed by default.
                    </TableCell>
                  </TableRow>
                ) : (
                  countries.map((c: any) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-mono font-bold">{c.countryCode}</TableCell>
                      <TableCell>{c.countryName}</TableCell>
                      <TableCell>
                        <Badge variant={c.allowed ? "default" : "destructive"}>
                          {c.allowed ? "Allowed" : "Blocked"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={c.allowed}
                          onCheckedChange={(allowed) =>
                            toggleCountryMutation.mutate({ id: c.id, allowed })
                          }
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Location & Delivery Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Activity className="w-5 h-5 text-primary" /> Recent Location Analytics & Serviceability Checks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User ID</TableHead>
                  <TableHead>Pincode / Coords</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Serviceable?</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>ETA</TableHead>
                  <TableHead>Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                      No location check logs recorded yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs">{log.userId || "Guest"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        {log.pincode || `${log.latitude}, ${log.longitude}`}
                      </TableCell>
                      <TableCell className="text-xs capitalize">{log.source}</TableCell>
                      <TableCell>
                        <Badge variant={log.serviceable ? "default" : "destructive"}>
                          {log.serviceable ? "Serviceable" : "Unserviceable"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">₹{log.calculatedFee || "0"}</TableCell>
                      <TableCell className="text-xs">{log.calculatedTimeMinutes ? `${log.calculatedTimeMinutes} min` : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Add Fee Rule Dialog */}
        <Dialog open={ruleDialog} onOpenChange={setRuleDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Distance Band Fee Rule</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Min Distance (km)</Label>
                  <Input
                    type="number"
                    value={ruleForm.minDistanceKm}
                    onChange={(e) => setRuleForm({ ...ruleForm, minDistanceKm: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Max Distance (km)</Label>
                  <Input
                    type="number"
                    value={ruleForm.maxDistanceKm}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxDistanceKm: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Base Fee (₹)</Label>
                  <Input
                    type="number"
                    value={ruleForm.baseFee}
                    onChange={(e) => setRuleForm({ ...ruleForm, baseFee: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Per Km Rate (₹/km)</Label>
                  <Input
                    type="number"
                    value={ruleForm.perKmFee}
                    onChange={(e) => setRuleForm({ ...ruleForm, perKmFee: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Max Fee Cap (₹)</Label>
                  <Input
                    type="number"
                    value={ruleForm.maxFeeCap}
                    onChange={(e) => setRuleForm({ ...ruleForm, maxFeeCap: e.target.value })}
                    placeholder="Optional cap"
                  />
                </div>
                <div>
                  <Label>Free Delivery Above (₹ Order)</Label>
                  <Input
                    type="number"
                    value={ruleForm.freeDeliveryAboveOrderValue}
                    onChange={(e) => setRuleForm({ ...ruleForm, freeDeliveryAboveOrderValue: e.target.value })}
                    placeholder="Optional order threshold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => saveRuleMutation.mutate(ruleForm)}
                  disabled={saveRuleMutation.isPending}
                  className="flex-1"
                >
                  Save Rule
                </Button>
                <Button variant="outline" onClick={() => setRuleDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
}
