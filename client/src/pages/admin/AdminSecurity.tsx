import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Trash2, RefreshCw, Lock, Unlock, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./AdminLayout";

import { apiRequest } from "@/lib/queryClient";

function SuperAdminPasswordUpdateCard() {
  const { toast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const updateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/update-password", {
        currentPassword,
        newPassword,
        totpCode,
      });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "🔑 Super Admin Password Updated!", description: data.message });
      setCurrentPassword("");
      setNewPassword("");
      setTotpCode("");
    },
    onError: (err: any) => {
      toast({ title: "Security Validation Failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className="border-emerald-500/40 bg-card shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground font-serif">
          <KeyRound className="w-5 h-5 text-emerald-400" />
          <span>Super Admin Password & 2FA TOTP Security</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Updating the Super Admin master account password requires validating your <strong>Current Password</strong> AND entering a live <strong>6-Digit Authenticator TOTP Code</strong>.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label className="text-xs font-bold text-foreground">Current (Old) Super Admin Password *</Label>
            <Input
              type="password"
              placeholder="Enter current password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-bold text-foreground">New Super Admin Password *</Label>
            <Input
              type="password"
              placeholder="Min 6 characters"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1"
            />
          </div>

          <div>
            <Label className="text-xs font-bold text-emerald-400">🔑 6-Digit TOTP Code *</Label>
            <Input
              type="text"
              placeholder="123456"
              maxLength={6}
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="mt-1 font-mono text-center tracking-widest font-bold border-emerald-500/50"
            />
          </div>
        </div>

        <Button
          onClick={() => updateMutation.mutate()}
          disabled={updateMutation.isPending || !currentPassword || newPassword.length < 6 || totpCode.length < 6}
          className="w-full py-3 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold rounded-xl shadow-lg"
        >
          {updateMutation.isPending ? "Validating Password & 2FA TOTP..." : "Verify Current Password + TOTP & Update Super Admin Password 🔑"}
        </Button>
      </CardContent>
    </Card>
  );
}

function ChiefAdminTotpCard() {
  const { toast } = useToast();
  const [verifyCode, setVerifyCode] = useState("");

  const { data: totpData, refetch } = useQuery({
    queryKey: ["/api/admin/mfa/totp/setup"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/mfa/totp/setup")).json(),
  });

  const verifyMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/mfa/totp/verify", { code: verifyCode })).json(),
    onSuccess: (data) => {
      toast({ title: "✨ 2FA TOTP Activated!", description: data.message });
      setVerifyCode("");
      refetch();
    },
    onError: (err: any) => toast({ title: "Verification Failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Card className="border-emerald-500/40 bg-card shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-foreground font-serif">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span>Chief Admin 2FA TOTP Security Layer</span>
          </div>
          {totpData?.enabled ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">ACTIVE & PROTECTED</Badge>
          ) : (
            <Badge variant="outline" className="text-amber-400 border-amber-500/40">SETUP REQUIRED</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Enforce unbypassable 2FA verification for Chief Admin access. Compatible with standard Authenticator Apps.
        </p>

        <div className="p-4 rounded-2xl bg-secondary/30 border border-emerald-500/20 space-y-3">
          <Label className="text-xs font-bold text-foreground">TOTP Secret Key</Label>
          <div className="p-2.5 rounded-xl bg-black/60 border border-card-border font-mono text-xs text-amber-400 tracking-widest select-all text-center">
            {totpData?.secret || "GENERATING..."}
          </div>
          <p className="text-[10px] text-muted-foreground text-center">
            Enter this secret key in your Authenticator App to generate 6-digit TOTP codes.
          </p>
        </div>

        <div className="p-4 rounded-2xl border border-emerald-500/30 bg-emerald-950/20 space-y-4">
          <Label className="text-xs font-bold text-emerald-400 block">Verify & Enable Chief Admin 2FA</Label>
          <div className="flex gap-3">
            <Input
              placeholder="Enter 6-digit TOTP code"
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              maxLength={6}
              className="text-center font-mono text-lg font-bold tracking-widest max-w-xs"
            />
            <Button
              onClick={() => verifyMutation.mutate()}
              disabled={verifyMutation.isPending || verifyCode.length < 6}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold"
            >
              {verifyMutation.isPending ? "Verifying..." : "Verify & Lock Down Chief Admin"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminSecurity() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [lockdownReason, setLockdownReason] = useState("");
  const [lockdownDialogOpen, setLockdownDialogOpen] = useState(false);

  const { data: lockdownData, isLoading: lockdownLoading } = useQuery({
    queryKey: ["/api/admin/security/lockdown"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/lockdown")).json(),
    refetchInterval: 15000,
  });

  const { data: auditData } = useQuery({
    queryKey: ["/api/admin/security/audit-log"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/audit-log?limit=50")).json(),
  });

  const { data: sessionsData } = useQuery({
    queryKey: ["/api/admin/security/sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/sessions")).json(),
  });

  const lockdownMutation = useMutation({
    mutationFn: async (payload: { active: boolean; reason: string }) =>
      (await apiRequest("POST", "/api/admin/security/lockdown", payload)).json(),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/lockdown"] });
      toast({ title: vars.active ? "🚨 Lockdown Activated" : "✅ Lockdown Deactivated", description: vars.active ? `Reason: ${vars.reason}` : "Platform is back online." });
      setLockdownDialogOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update lockdown state.", variant: "destructive" }),
  });

  const revokeSessionMutation = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/admin/security/sessions/${id}`)).json(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/sessions"] });
      toast({ title: "Session Revoked" });
    },
  });

  const isLocked = lockdownData?.active ?? false;

  // Telegram Security State
  const [botToken, setBotToken] = useState("");
  const [chatId, setChatId] = useState("");
  const [telegramLoaded, setTelegramLoaded] = useState(false);

  const { data: telegramData } = useQuery({
    queryKey: ["/api/admin/security/telegram"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/telegram");
      const data = await res.json();
      if (!telegramLoaded) {
        if (data.botToken && !data.botToken.includes("...")) {
          setBotToken(data.botToken);
        }
        setChatId(data.chatId || "");
        setTelegramLoaded(true);
      }
      return data;
    },
  });

  const saveTelegramMutation = useMutation({
    mutationFn: async (payload: { botToken: string; chatId: string }) => {
      const res = await apiRequest("POST", "/api/admin/security/telegram", payload);
      return res.json();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      toast({ title: "✨ Telegram Settings Saved", description: res.message });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setupWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/setup-webhook");
      return res.json();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      toast({ title: "✨ Telegram Webhook Registered!", description: res.message });
    },
    onError: (err: any) => toast({ title: "Webhook Registration Error", description: err.message, variant: "destructive" }),
  });

  const testAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/test-alert");
      return res.json();
    },
    onSuccess: (res) => toast({ title: "🔔 Test Alert Sent!", description: res.message }),
    onError: (err: any) => toast({ title: "Alert Failed", description: err.message, variant: "destructive" }),
  });

  const eventBadgeColor = (type: string) => {
    if (type.includes("failed") || type.includes("lockdown_on")) return "destructive";
    if (type.includes("rate_limit")) return "outline";
    if (type.includes("success") || type.includes("lockdown_off")) return "default";
    return "secondary";
  };

  return (
    <AdminLayout title="Security Dashboard">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-sm">Monitor sessions, audit logs, and control platform lockdown.</p>
          </div>
          <Badge variant={isLocked ? "destructive" : "default"} className="text-sm px-3 py-1">
            {isLocked ? <ShieldAlert className="w-4 h-4 mr-1 inline" /> : <ShieldCheck className="w-4 h-4 mr-1 inline" />}
            {isLocked ? "LOCKED" : "ONLINE"}
          </Badge>
        </div>

      {/* Lockdown Control */}
      <Card className={isLocked ? "border-red-500 bg-red-950/20" : ""}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isLocked ? <Lock className="w-5 h-5 text-red-400" /> : <Unlock className="w-5 h-5" />}
            Platform Lockdown
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {isLocked && (
            <div className="bg-red-900/30 border border-red-600 rounded p-3 text-sm">
              <p className="font-semibold text-red-300 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> Platform is currently LOCKED</p>
              <p className="text-red-400 mt-1">Reason: {lockdownData?.reason || "No reason provided"}</p>
            </div>
          )}
          <p className="text-sm text-muted-foreground">
            {isLocked
              ? "All customer API endpoints are returning 423 (Locked). Only admin routes are accessible."
              : "Platform is fully operational. Use lockdown only in security emergencies."}
          </p>
          <Dialog open={lockdownDialogOpen} onOpenChange={setLockdownDialogOpen}>
            <DialogTrigger asChild>
              <Button variant={isLocked ? "outline" : "destructive"} className="w-full sm:w-auto">
                {isLocked ? "Deactivate Lockdown" : "Activate Lockdown"}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{isLocked ? "Deactivate Platform Lockdown" : "Activate Emergency Lockdown"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                {!isLocked && (
                  <div className="space-y-2">
                    <Label>Reason for lockdown *</Label>
                    <Input
                      placeholder="e.g. Security incident investigation"
                      value={lockdownReason}
                      onChange={(e) => setLockdownReason(e.target.value)}
                    />
                  </div>
                )}
                {!isLocked && (
                  <div className="bg-amber-900/30 border border-amber-600 rounded p-3 text-sm text-amber-200">
                    <AlertTriangle className="w-4 h-4 inline mr-1" />
                    This will block ALL customer requests immediately. Only admin routes will remain accessible.
                  </div>
                )}
                <div className="flex gap-2">
                  <Button
                    variant={isLocked ? "default" : "destructive"}
                    onClick={() => lockdownMutation.mutate({ active: !isLocked, reason: lockdownReason || "Admin deactivation" })}
                    disabled={lockdownMutation.isPending || (!isLocked && !lockdownReason)}
                    className="flex-1"
                  >
                    {lockdownMutation.isPending ? "Processing..." : isLocked ? "Deactivate" : "Activate Lockdown"}
                  </Button>
                  <Button variant="outline" onClick={() => setLockdownDialogOpen(false)}>Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Chief Admin 2FA TOTP & Passkeys */}
      <ChiefAdminTotpCard />

      {/* Super Admin Password Change with TOTP & Old Password Validation */}
      <SuperAdminPasswordUpdateCard />

      {/* Telegram Security Bot Controller */}
      <Card className="border-emerald-500/30 bg-card shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-950/40 via-card to-card border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground font-serif">
              <span className="text-xl">🤖</span> Telegram Remote Security & Webhook Controller
            </CardTitle>
            <Badge variant={telegramData?.configured ? "default" : "outline"} className={telegramData?.configured ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
              {telegramData?.configured ? "🟢 Connected & Secured" : "⚠️ Token & Chat ID Required"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Configure your Telegram Bot token, Chat ID, auto-register the Telegram webhook with 1-click, and test security notifications directly from this Superadmin panel.
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bot-token" className="text-xs font-bold">Telegram Bot Token (from @BotFather)</Label>
              <Input
                id="bot-token"
                type="password"
                placeholder={telegramData?.configured ? "•••••••••••••••• (Saved. Type to change)" : "e.g. 7123456789:AAFx..."}
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl border-emerald-500/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Obtain from Telegram @BotFather by running /newbot</p>
            </div>

            <div>
              <Label htmlFor="chat-id" className="text-xs font-bold">Verified Telegram Chat ID (from @userinfobot)</Label>
              <Input
                id="chat-id"
                type="text"
                placeholder="e.g. 123456789"
                value={chatId}
                onChange={(e) => setChatId(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl border-emerald-500/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Obtain from Telegram @userinfobot by sending any message</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => saveTelegramMutation.mutate({ botToken, chatId })}
              disabled={saveTelegramMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-primary hover:from-emerald-500 hover:to-green-500 text-white font-bold rounded-xl text-xs py-4 px-5 shadow-lg"
            >
              {saveTelegramMutation.isPending ? "Saving..." : "💾 Save Telegram Credentials"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setupWebhookMutation.mutate()}
              disabled={setupWebhookMutation.isPending || !telegramData?.configured}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-xl text-xs py-4 px-5"
            >
              {setupWebhookMutation.isPending ? "Registering..." : "⚡ Auto-Register Telegram Webhook"}
            </Button>

            <Button
              variant="outline"
              onClick={() => testAlertMutation.mutate()}
              disabled={testAlertMutation.isPending || !telegramData?.configured}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-bold rounded-xl text-xs py-4 px-5"
            >
              {testAlertMutation.isPending ? "Sending..." : "🔔 Send Test Security Alert"}
            </Button>
          </div>

          {/* Quick Telegram Commands Guide */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-emerald-500/20 text-xs space-y-2">
            <p className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span>📱 Remote Telegram Commands (Send to your bot):</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/lock on [reason]</span>
                <span className="text-muted-foreground text-[10px]">Turn on emergency lockdown</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/lock off</span>
                <span className="text-muted-foreground text-[10px]">Turn off platform lockdown</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/lock or /status</span>
                <span className="text-muted-foreground text-[10px]">Check live system status</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Active Sessions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            Active Sessions
            <Button size="sm" variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/security/sessions"] })}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(sessionsData?.sessions || []).length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No active sessions</TableCell></TableRow>
              ) : (
                (sessionsData?.sessions || []).map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.email || `User #${s.userId}`}</TableCell>
                    <TableCell><Badge variant="outline">{s.platform}</Badge></TableCell>
                    <TableCell className="font-mono text-xs">{s.ipAtIssue || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.expiresAt).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300" onClick={() => revokeSessionMutation.mutate(s.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Audit Log */}
      <Card>
        <CardHeader><CardTitle>Security Audit Log</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>User</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Platform</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditData?.logs || []).length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No audit events yet</TableCell></TableRow>
              ) : (
                (auditData?.logs || []).map((log: any) => (
                  <TableRow key={log.id}>
                    <TableCell><Badge variant={eventBadgeColor(log.eventType)}>{log.eventType}</Badge></TableCell>
                    <TableCell className="text-sm">{log.email || (log.userId ? `#${log.userId}` : "—")}</TableCell>
                    <TableCell className="font-mono text-xs">{log.ip || "—"}</TableCell>
                    <TableCell className="text-xs">{log.platform || "web"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-48 truncate">{log.actionTaken || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </AdminLayout>
  );
}
