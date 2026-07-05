import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { KeyRound, Percent, Gift, Truck, Store, Save } from "lucide-react";
import { AdminLayout } from "./AdminLayout";
import { apiGet, apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SettingsMap = Record<string, string>;

// Known keys grouped for a friendlier form. Anything else discovered from the
// API is rendered generically below so we never drop unknown settings.
const DISCOUNT_KEYS = [
  { key: "first_order_discount_enabled", label: "Enable first-order discount", type: "bool" as const },
  { key: "first_order_discount_percent", label: "First order discount %", type: "percent" as const },
];
const REFERRAL_KEYS = [
  { key: "referral_enabled", label: "Enable referral program", type: "bool" as const },
  { key: "referral_new_customer_percent", label: "New customer referral discount %", type: "percent" as const },
  { key: "referral_reward_percent", label: "Referrer reward %", type: "percent" as const },
  { key: "referral_reward_max_percent_per_order", label: "Max referral reward cap % per order", type: "percent" as const },
];
const DELIVERY_KEYS = [
  { key: "subscription_delivery_days", label: "Subscription delivery days", type: "delivery_days" as const },
];
const STORE_KEYS = [
  { key: "store_name", label: "Store name", type: "text" as const },
];

const ALL_KNOWN_KEYS = [...DISCOUNT_KEYS, ...REFERRAL_KEYS, ...DELIVERY_KEYS, ...STORE_KEYS].map((k) => k.key);

function FieldRow({
  field,
  value,
  onChange,
}: {
  field: { key: string; label: string; type: "bool" | "percent" | "text" | "delivery_days" };
  value: string | undefined;
  onChange: (key: string, value: string) => void;
}) {
  const v = value ?? "";
  if (field.type === "bool") {
    return (
      <div className="flex items-center justify-between py-2">
        <Label htmlFor={`set-${field.key}`} className="cursor-pointer">{field.label}</Label>
        <Switch
          id={`set-${field.key}`}
          checked={v === "true"}
          onCheckedChange={(checked) => onChange(field.key, checked ? "true" : "false")}
          data-testid={`switch-setting-${field.key}`}
        />
      </div>
    );
  }
  if (field.type === "delivery_days") {
    return (
      <div className="py-2">
        <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
        <Select value={v || "both"} onValueChange={(val) => onChange(field.key, val)}>
          <SelectTrigger id={`set-${field.key}`} className="mt-1" data-testid={`select-setting-${field.key}`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="saturday">Saturday only</SelectItem>
            <SelectItem value="sunday">Sunday only</SelectItem>
            <SelectItem value="both">Both Saturday &amp; Sunday</SelectItem>
          </SelectContent>
        </Select>
      </div>
    );
  }
  if (field.type === "percent") {
    return (
      <div className="py-2">
        <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
        <div className="relative mt-1">
          <Input
            id={`set-${field.key}`}
            type="number"
            min={0}
            max={100}
            value={v}
            onChange={(e) => onChange(field.key, e.target.value)}
            data-testid={`input-setting-${field.key}`}
          />
          <Percent size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>
    );
  }
  return (
    <div className="py-2">
      <Label htmlFor={`set-${field.key}`}>{field.label}</Label>
      <Input
        id={`set-${field.key}`}
        value={v}
        onChange={(e) => onChange(field.key, e.target.value)}
        className="mt-1"
        data-testid={`input-setting-${field.key}`}
      />
    </div>
  );
}

export default function AdminSettings() {
  const { user } = useAuth();
  const { toast } = useToast();

  // ---------- Business settings ----------
  const { data: settingsData, isLoading: settingsLoading } = useQuery({
    queryKey: ["/api/admin/settings"],
    queryFn: () => apiGet<SettingsMap>("/api/admin/settings"),
  });

  const [form, setForm] = useState<SettingsMap>({});

  useEffect(() => {
    if (settingsData) setForm(settingsData);
  }, [settingsData]);

  function setField(key: string, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  const saveSettings = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/settings", form);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/settings"] });
      toast({ title: "Settings saved", description: "Business settings updated successfully." });
    },
    onError: () => {
      toast({ title: "Could not save settings", description: "Please try again.", variant: "destructive" });
    },
  });

  const unknownKeys = Object.keys(form).filter((k) => !ALL_KNOWN_KEYS.includes(k));

  // ---------- Password change ----------
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");

  const change = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/change-password", { currentPassword: current, newPassword: next });
    },
    onSuccess: () => {
      setCurrent(""); setNext(""); setConfirm("");
      toast({ title: "Password changed", description: "Use your new password next time you log in." });
    },
    onError: (e: any) => {
      const msg = String(e?.message || "");
      toast({ title: "Could not change password", description: msg.includes("401") ? "Current password is incorrect." : "Please try again.", variant: "destructive" });
    },
  });

  function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 4) return toast({ title: "Password too short", description: "Use at least 4 characters.", variant: "destructive" });
    if (next !== confirm) return toast({ title: "Passwords do not match", variant: "destructive" });
    change.mutate();
  }

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl space-y-6">
        {/* Business settings */}
        <div className="rounded-xl border border-card-border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-xl">Business settings</h2>
            <Button
              size="sm"
              onClick={() => saveSettings.mutate()}
              disabled={saveSettings.isPending || settingsLoading}
              data-testid="button-save-settings"
            >
              <Save size={16} className="mr-1.5" />
              {saveSettings.isPending ? "Saving…" : "Save changes"}
            </Button>
          </div>

          {settingsLoading ? (
            <p className="text-sm text-muted-foreground">Loading settings…</p>
          ) : (
            <div className="space-y-6">
              <section>
                <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                  <Percent size={16} /> Discounts
                </div>
                <div className="divide-y divide-card-border">
                  {DISCOUNT_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                  <Gift size={16} /> Referrals
                </div>
                <div className="divide-y divide-card-border">
                  {REFERRAL_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                  <Truck size={16} /> Delivery
                </div>
                <div className="divide-y divide-card-border">
                  {DELIVERY_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              <section>
                <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                  <Store size={16} /> Store
                </div>
                <div className="divide-y divide-card-border">
                  {STORE_KEYS.map((f) => (
                    <FieldRow key={f.key} field={f} value={form[f.key]} onChange={setField} />
                  ))}
                </div>
              </section>

              {unknownKeys.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-1 text-sm font-semibold text-primary">
                    Other settings
                  </div>
                  <div className="divide-y divide-card-border">
                    {unknownKeys.map((key) => (
                      <div key={key} className="py-2">
                        <Label htmlFor={`set-${key}`}>{key}</Label>
                        <Input
                          id={`set-${key}`}
                          value={form[key] ?? ""}
                          onChange={(e) => setField(key, e.target.value)}
                          className="mt-1"
                          data-testid={`input-setting-${key}`}
                        />
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        {/* Password change */}
        <div className="rounded-xl border border-card-border bg-card p-6">
          <div className="flex items-center gap-2 mb-1">
            <KeyRound size={18} className="text-primary" />
            <h2 className="font-semibold">Change admin password</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Logged in as {user?.email}</p>
          <form onSubmit={submitPassword} className="space-y-4">
            <div>
              <Label htmlFor="cur">Current password</Label>
              <Input id="cur" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} required data-testid="input-current-password" />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input id="new" type="password" value={next} onChange={(e) => setNext(e.target.value)} required data-testid="input-new-password" />
            </div>
            <div>
              <Label htmlFor="conf">Confirm new password</Label>
              <Input id="conf" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required data-testid="input-confirm-password" />
            </div>
            <Button type="submit" disabled={change.isPending} data-testid="button-change-password">
              {change.isPending ? "Updating…" : "Update password"}
            </Button>
          </form>
        </div>

        <p className="text-xs text-muted-foreground">
          Tip: the default admin password is set in the code at <code className="bg-secondary px-1 rounded">server/storage.ts</code>.
          Changing it here updates it instantly without touching code.
        </p>
      </div>
    </AdminLayout>
  );
}
