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
import { Warehouse, Plus, Pencil, Trash2, MapPin, Search, CheckCircle2, XCircle, Clock, Truck, PackageCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./AdminLayout";

const apiRequest = async (method: string, url: string, body?: any) => {
  const res = await fetch(url, {
    method,
    headers: { 
      "Content-Type": "application/json",
      ...(localStorage.getItem("accessToken") || localStorage.getItem("token") ? { Authorization: `Bearer ${localStorage.getItem("accessToken") || localStorage.getItem("token")}` } : {})
    },
    credentials: "include",
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error((await res.json()).message || "Request failed");
  return res.json();
};

const emptyWarehouse = {
  name: "",
  latitude: "",
  longitude: "",
  averageSpeedKmph: "30",
  defaultPackingMins: "30",
  active: true,
  initialPincodes: "", // Comma-separated PINs
};

export default function AdminWarehouses() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(emptyWarehouse);
  const [pincodeWarehouseId, setPincodeWarehouseId] = useState<number | null>(null);
  const [newPincode, setNewPincode] = useState({ pincode: "", packingTimeMinutes: 30 });

  // Test serviceability widget state
  const [testInput, setTestInput] = useState("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testLoading, setTestLoading] = useState(false);

  const { data: warehousesData } = useQuery({
    queryKey: ["/api/admin/warehouses"],
    queryFn: () => apiRequest("GET", "/api/admin/warehouses"),
  });

  const { data: pincodesData } = useQuery({
    queryKey: ["/api/admin/warehouses", pincodeWarehouseId, "pincodes"],
    queryFn: () => apiRequest("GET", `/api/admin/warehouses/${pincodeWarehouseId}/pincodes`),
    enabled: !!pincodeWarehouseId,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      let warehouse: any;
      if (editing) {
        warehouse = await apiRequest("PATCH", `/api/admin/warehouses/${editing.id}`, {
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          averageSpeedKmph: data.averageSpeedKmph,
          active: data.active,
        });
      } else {
        warehouse = await apiRequest("POST", "/api/admin/warehouses", {
          name: data.name,
          latitude: data.latitude,
          longitude: data.longitude,
          averageSpeedKmph: data.averageSpeedKmph,
          active: data.active,
          initialPincodes: data.initialPincodes || undefined,
          defaultPackingMins: data.defaultPackingMins || "30",
        });
      }
      return warehouse;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/warehouses"] });
      toast({ title: editing ? "Warehouse updated" : "Warehouse created with expected packing times!" });
      setDialogOpen(false);
      setForm(emptyWarehouse);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/warehouses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/warehouses"] });
      toast({ title: "Warehouse deleted" });
    },
  });

  const addPincodeMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", `/api/admin/warehouses/${pincodeWarehouseId}/pincodes`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/warehouses", pincodeWarehouseId, "pincodes"] });
      setNewPincode({ pincode: "", packingTimeMinutes: 30 });
      toast({ title: "PIN code added with packing time!" });
    },
  });

  const deletePincodeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/admin/warehouses/pincodes/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/admin/warehouses", pincodeWarehouseId, "pincodes"] }),
  });

  const handleTestServiceability = async () => {
    if (!testInput.trim()) return;
    setTestLoading(true);
    setTestResult(null);
    try {
      const isCoords = testInput.includes(",");
      const body = isCoords
        ? { lat: parseFloat(testInput.split(",")[0]), lng: parseFloat(testInput.split(",")[1]) }
        : { pincode: testInput.trim() };
      const res = await apiRequest("POST", "/api/delivery/resolve", body);
      setTestResult(res);
    } catch (e: any) {
      setTestResult({ serviceable: false, reason: e.message });
    } finally {
      setTestLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(emptyWarehouse);
    setDialogOpen(true);
  };

  const openEdit = (w: any) => {
    setEditing(w);
    setForm({
      name: w.name,
      latitude: w.latitude,
      longitude: w.longitude,
      averageSpeedKmph: w.averageSpeedKmph,
      defaultPackingMins: "30",
      active: w.active,
      initialPincodes: "",
    });
    setDialogOpen(true);
  };

  const warehouses = warehousesData?.warehouses || [];

  return (
    <AdminLayout title="Warehouses & Expected Packing Time Settings">
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-sm">
              Configure warehouse packing & dispatch times, transit speeds, and assign serviceable PIN codes.
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 bg-emerald-600 hover:bg-emerald-500 text-white font-bold">
            <Plus className="w-4 h-4 mr-2" /> Add Warehouse
          </Button>
        </div>

        {/* Live Serviceability Tester Widget */}
        <Card className="border-emerald-500/30 bg-emerald-950/20">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-emerald-400">
              <Search className="w-4 h-4 text-emerald-400" /> Live Warehouse Serviceability & Packing Time Checker
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <Input
                placeholder="Enter PIN code (e.g. 530001) or Coordinates (e.g. 17.6868, 83.2185)"
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleTestServiceability()}
                className="bg-background"
              />
              <Button onClick={handleTestServiceability} disabled={testLoading || !testInput} className="bg-emerald-600 hover:bg-emerald-500">
                {testLoading ? "Checking…" : "Check Delivery ETA"}
              </Button>
            </div>

            {testResult && (
              <div
                className={`p-3.5 rounded-xl border text-sm flex items-start gap-3 ${
                  testResult.serviceable
                    ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-100"
                    : "bg-red-950/60 border-red-500/50 text-red-100"
                }`}
              >
                {testResult.serviceable ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <p className="font-bold text-base">
                    {testResult.serviceable
                      ? `SERVICEABLE — Warehouse: ${testResult.warehouseName || testResult.warehouseId}`
                      : `NOT SERVICEABLE (${testResult.reason || "Beyond reach"})`}
                  </p>
                  {testResult.serviceable && (
                    <div className="flex flex-wrap items-center gap-4 text-xs pt-1">
                      <span className="flex items-center gap-1 font-semibold text-amber-300">
                        <PackageCheck className="w-4 h-4 text-amber-400" /> Expected Packing Time: <strong>{testResult.packingTimeMinutes || 30} mins</strong>
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-emerald-300">
                        <Clock className="w-4 h-4 text-emerald-400" /> Combined Total Delivery ETA: <strong>{testResult.etaMinutes} mins</strong>
                      </span>
                      <span className="flex items-center gap-1 font-semibold text-white">
                        <Truck className="w-4 h-4 text-emerald-400" /> Delivery Fee: <strong>₹{testResult.fee}</strong>
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Warehouses List */}
        <div className="grid gap-4">
          {warehouses.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                No warehouses registered yet. Click "Add Warehouse" to configure your first warehouse and packing times.
              </CardContent>
            </Card>
          ) : (
            warehouses.map((w: any) => (
              <Card key={w.id} className="border-emerald-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-foreground font-serif">
                      <MapPin className="w-5 h-5 text-emerald-500" /> {w.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant={w.active ? "default" : "secondary"} className={w.active ? "bg-emerald-600" : ""}>
                        {w.active ? "Active & Dispatching" : "Inactive"}
                      </Badge>
                      <Button size="sm" variant="outline" onClick={() => openEdit(w)}>
                        <Pencil className="w-3 h-3 mr-1" /> Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-500 hover:text-red-400"
                        onClick={() => deleteMutation.mutate(w.id)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-3 gap-4 text-sm bg-muted/40 p-3 rounded-xl border border-emerald-500/10">
                    <div>
                      <span className="text-muted-foreground text-xs block">Latitude</span>
                      <p className="font-mono font-medium">{w.latitude}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">Longitude</span>
                      <p className="font-mono font-medium">{w.longitude}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs block">Transit Rider Speed</span>
                      <p className="font-medium text-emerald-400">{w.averageSpeedKmph} km/h</p>
                    </div>
                  </div>

                  {/* Pincode Management */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-foreground">Serviceable PIN Codes & Expected Packing Times</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPincodeWarehouseId(pincodeWarehouseId === w.id ? null : w.id)}
                      >
                        {pincodeWarehouseId === w.id ? "Hide Pincodes" : "Manage Pincodes & Packing Times"}
                      </Button>
                    </div>

                    {pincodeWarehouseId === w.id && (
                      <div className="border border-emerald-500/20 rounded-xl p-4 space-y-4 bg-background">
                        <div className="flex flex-wrap gap-3 items-end">
                          <div>
                            <Label className="text-xs mb-1 block">PIN Code</Label>
                            <Input
                              placeholder="e.g. 530001"
                              value={newPincode.pincode}
                              onChange={(e) => setNewPincode((p) => ({ ...p, pincode: e.target.value }))}
                              className="w-36"
                            />
                          </div>
                          <div>
                            <Label className="text-xs mb-1 block">Expected Packing Time (Mins)</Label>
                            <Input
                              type="number"
                              placeholder="30"
                              value={newPincode.packingTimeMinutes}
                              onChange={(e) =>
                                setNewPincode((p) => ({
                                  ...p,
                                  packingTimeMinutes: parseInt(e.target.value, 10) || 30,
                                }))
                              }
                              className="w-48"
                            />
                          </div>
                          <Button
                            size="sm"
                            onClick={() => addPincodeMutation.mutate(newPincode)}
                            disabled={!newPincode.pincode || addPincodeMutation.isPending}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            <Plus className="w-4 h-4 mr-1" /> Add PIN & Packing Time
                          </Button>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>PIN Code</TableHead>
                              <TableHead>Expected Packing Time</TableHead>
                              <TableHead>Status</TableHead>
                              <TableHead>Action</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {(pincodesData?.pincodes || []).length === 0 ? (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground py-4">
                                  No PIN codes registered under this warehouse yet. Add a PIN code above.
                                </TableCell>
                              </TableRow>
                            ) : (
                              (pincodesData?.pincodes || []).map((pc: any) => (
                                <TableRow key={pc.id}>
                                  <TableCell className="font-mono font-bold text-emerald-400">{pc.pincode}</TableCell>
                                  <TableCell className="font-bold text-amber-300">📦 {pc.packingTimeMinutes} mins</TableCell>
                                  <TableCell>
                                    <Badge variant={pc.active ? "default" : "secondary"}>
                                      {pc.active ? "Active" : "Disabled"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      className="text-red-500 hover:text-red-400"
                                      onClick={() => deletePincodeMutation.mutate(pc.id)}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Create/Edit Warehouse Modal */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit Warehouse Settings" : "Add New Warehouse"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Warehouse Name</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f: any) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Visakhapatnam Central Hub"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Latitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.latitude}
                    onChange={(e) => setForm((f: any) => ({ ...f, latitude: e.target.value }))}
                    placeholder="17.6868"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Longitude</Label>
                  <Input
                    type="number"
                    step="any"
                    value={form.longitude}
                    onChange={(e) => setForm((f: any) => ({ ...f, longitude: e.target.value }))}
                    placeholder="83.2185"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label>Expected Packing Time for Initial PINs (Minutes)</Label>
                <Input
                  type="number"
                  value={form.defaultPackingMins}
                  onChange={(e) => setForm((f: any) => ({ ...f, defaultPackingMins: e.target.value }))}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">
                  Expected time taken by warehouse staff to pack and prepare order items for dispatch.
                </p>
              </div>

              <div className="space-y-1">
                <Label>Rider Transit Delivery Speed (km/h)</Label>
                <Input
                  type="number"
                  value={form.averageSpeedKmph}
                  onChange={(e) => setForm((f: any) => ({ ...f, averageSpeedKmph: e.target.value }))}
                  placeholder="30"
                />
                <p className="text-xs text-muted-foreground">
                  Used by system to estimate travel duration to customer address.
                </p>
              </div>

              {!editing && (
                <div className="space-y-1">
                  <Label>Initial Serviceable PIN Codes (Optional)</Label>
                  <Input
                    value={form.initialPincodes}
                    onChange={(e) => setForm((f: any) => ({ ...f, initialPincodes: e.target.value }))}
                    placeholder="e.g. 530001, 530002, 530003"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter comma-separated PIN codes to auto-assign them with your specified packing time.
                  </p>
                </div>
              )}

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={form.active}
                  onCheckedChange={(v) => setForm((f: any) => ({ ...f, active: v }))}
                />
                <Label>Active (Ready to serve orders)</Label>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  onClick={() => saveMutation.mutate(form)}
                  disabled={!form.name || !form.latitude || !form.longitude || saveMutation.isPending}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                >
                  {saveMutation.isPending ? "Saving…" : "Save Warehouse"}
                </Button>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
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
