import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, Trash2, RefreshCw, Lock, Unlock, KeyRound, Plus, Copy, Check, Search, Terminal, ShieldX, Fingerprint, Smartphone, Monitor } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLayout } from "./AdminLayout";
import { ChiefExecutiveExclusiveControls } from "@/components/admin/ChiefExecutiveExclusiveControls";
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

function WebAuthnPasskeysCard() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [nickname, setNickname] = useState("");
  const [enrolling, setEnrolling] = useState(false);
  const [testing, setTesting] = useState(false);

  const { data: webauthnData, refetch } = useQuery<{
    credentials: Array<{
      id: number;
      credentialId: string;
      nickname: string;
      deviceType: string;
      backedUp: boolean;
      lastUsedAt: string | null;
      createdAt: string;
    }>;
    count: number;
  }>({
    queryKey: ["/api/admin/webauthn/credentials"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/webauthn/credentials")).json(),
  });

  const credentials = webauthnData?.credentials || [];
  const count = webauthnData?.count || 0;

  const handleEnrollPasskey = async () => {
    setEnrolling(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/admin/webauthn/register/options");
      const options = await optionsRes.json();

      const { startRegistration } = await import("@simplewebauthn/browser");
      const attResp = await startRegistration(options);

      const verifyRes = await apiRequest("POST", "/api/admin/webauthn/register/verify", {
        response: attResp,
        nickname: nickname.trim() || (navigator.platform?.includes("Mac") ? "Mac Touch ID" : "Hardware Security Key"),
      });
      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        toast({
          title: "🔐 WebAuthn Passkey Enrolled!",
          description: `Phishing-resistant passkey successfully bound to hardware (Total: ${verifyData.count}).`,
        });
        setNickname("");
        refetch();
        qc.invalidateQueries({ queryKey: ["/api/admin/webauthn/credentials"] });
      }
    } catch (err: any) {
      toast({
        title: "Passkey Enrollment Failed",
        description: err?.message || "User cancelled or hardware not recognized.",
        variant: "destructive",
      });
    } finally {
      setEnrolling(false);
    }
  };

  const handleTestPasskey = async () => {
    setTesting(true);
    try {
      const optionsRes = await apiRequest("POST", "/api/admin/webauthn/auth/options");
      const options = await optionsRes.json();

      const { startAuthentication } = await import("@simplewebauthn/browser");
      const asseResp = await startAuthentication(options);

      const verifyRes = await apiRequest("POST", "/api/admin/webauthn/auth/verify", {
        response: asseResp,
      });
      const verifyData = await verifyRes.json();

      if (verifyData.verified) {
        toast({
          title: "✨ WebAuthn Assertion Verified!",
          description: "Hardware signature matched successfully. Step-up assurance level confirmed.",
        });
        refetch();
      }
    } catch (err: any) {
      toast({
        title: "Passkey Test Failed",
        description: err?.message || "Authentication cancelled or signature mismatch.",
        variant: "destructive",
      });
    } finally {
      setTesting(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/admin/webauthn/credentials/${id}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Passkey Removed", description: "The backup passkey was deleted." });
      refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/webauthn/credentials"] });
    },
    onError: (err: any) => {
      toast({ title: "Failed to Delete", description: err.message, variant: "destructive" });
    },
  });

  return (
    <Card className={`shadow-xl transition-all ${count > 0 ? "border-emerald-500/50 bg-card" : "border-amber-500/50 bg-card"}`}>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2.5 text-foreground font-serif">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${
              count > 0
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
            }`}>
              <Fingerprint className="w-5 h-5" />
            </div>
            <div>
              <span>WebAuthn &amp; FIDO2 Hardware Passkeys</span>
              <p className="text-xs font-normal text-muted-foreground mt-0.5">
                Phishing-resistant authentication bound cryptographically to physical devices (Mac Touch ID, Face ID, YubiKey).
              </p>
            </div>
          </CardTitle>
          <Badge
            className={`self-start sm:self-auto text-[10px] font-black px-3 py-1 rounded-full border ${
              count >= 2
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                : count === 1
                ? "bg-sky-500/20 text-sky-400 border-sky-500/30"
                : "bg-amber-500/20 text-amber-300 border-amber-500/30"
            }`}
          >
            {count >= 2
              ? `🟢 HARDENED (${count} ENROLLED)`
              : count === 1
              ? `🟡 1 ENROLLED (ADD BACKUP KEY)`
              : "⚠️ SETUP REQUIRED"}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {credentials.length > 0 ? (
          <div className="space-y-3">
            <Label className="text-xs font-bold text-foreground">Enrolled Hardware Passkeys ({credentials.length})</Label>
            <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-secondary/20 overflow-hidden">
              {credentials.map((cred) => (
                <div key={cred.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-secondary/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-xl bg-card border border-border flex items-center justify-center text-emerald-400 shrink-0">
                      {cred.deviceType === "platform" ? <Monitor size={16} /> : <Smartphone size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground truncate flex items-center gap-2">
                        <span>{cred.nickname}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                          {cred.deviceType}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                        Enrolled: {new Date(cred.createdAt).toLocaleDateString()} {cred.lastUsedAt && `• Last used: ${new Date(cred.lastUsedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(cred.id)}
                      disabled={deleteMutation.isPending || credentials.length <= 1}
                      className="h-8 px-2.5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/20"
                      title={credentials.length <= 1 ? "Cannot delete the only passkey" : "Delete passkey"}
                    >
                      <Trash2 size={13} className="mr-1" /> Remove
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200/90 leading-relaxed">
            <strong>⚠️ Zero WebAuthn Passkeys Enrolled:</strong> Enroll your primary Mac Touch ID / Face ID and a secondary hardware security key (or backup device) to enforce phishing-resistant root administration.
          </div>
        )}

        <div className="p-4 rounded-2xl bg-card border border-emerald-500/30 space-y-3">
          <Label className="text-xs font-bold text-emerald-400 block">Enroll New FIDO2 Passkey / Touch ID</Label>
          <div className="flex flex-col sm:flex-row gap-3">
            <Input
              placeholder="Passkey Label (e.g. MacBook Pro Touch ID, YubiKey 5C)"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              className="text-xs"
            />
            <Button
              onClick={handleEnrollPasskey}
              disabled={enrolling}
              className="bg-emerald-600 hover:bg-emerald-500 font-bold text-xs shrink-0 cursor-pointer h-10 px-4"
            >
              {enrolling ? "Waiting for Biometrics..." : "🔑 Enroll Hardware Passkey"}
            </Button>
          </div>
          {count > 0 && (
            <div className="pt-2 flex items-center justify-between border-t border-border/40">
              <span className="text-[11px] text-muted-foreground">Test assertion signature &amp; step-up verification:</span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTestPasskey}
                disabled={testing}
                className="text-xs font-bold h-8 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
              >
                {testing ? "Testing Signature..." : "✨ Test Passkey Verification"}
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmergencyBreakGlassCodesCard() {
  const { toast } = useToast();
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  const { data: statusData, refetch } = useQuery({
    queryKey: ["/api/admin/emergency-codes/status"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/emergency-codes/status")).json(),
  });

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await apiRequest("POST", "/api/admin/emergency-codes/generate");
      const data = await res.json();
      setGeneratedCodes(data.codes || []);
      refetch();
      toast({
        title: "🛡️ 10 Emergency Recovery Codes Generated!",
        description: "Save these codes offline immediately. They will NEVER be shown again.",
      });
    } catch (err: any) {
      toast({
        title: "Failed to generate emergency codes",
        description: err?.message || "Super Admin authorization required.",
        variant: "destructive",
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleDownload = () => {
    if (!generatedCodes.length) return;
    const content = `FARMFRESHFARMER — CHIEF SUPER ADMIN EMERGENCY RECOVERY CODES
================================================================
Generated: ${new Date().toISOString()}
Account: admin@farmfreshfarmer.com
Security: Break-Glass Disaster Recovery

Use these single-use codes to log in or reset your password if your phone,
laptop, or Authenticator app is lost or compromised.

${generatedCodes.map((c, i) => `[${i + 1}] ${c}`).join("\n")}

================================================================
STORE THIS FILE OFFLINE (USB / SAFE VAULT / PRINTED PAPER).
`;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `FarmFreshFarmer-Emergency-Backup-Codes-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📁 Emergency Codes Downloaded as Text File" });
  };

  const handleCopy = () => {
    if (!generatedCodes.length) return;
    navigator.clipboard.writeText(generatedCodes.join("\n"));
    toast({ title: "📋 10 Emergency Codes Copied to Clipboard" });
  };

  return (
    <Card className="border-amber-500/40 bg-card shadow-xl overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-amber-950/30 via-card to-card border-b border-amber-500/20">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-foreground font-serif">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <span>Chief Admin "Break-Glass" Emergency Recovery Codes</span>
          </CardTitle>
          {statusData?.configured ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
              {statusData.remainingCodes} CODES REMAINING
            </Badge>
          ) : (
            <Badge variant="outline" className="text-amber-400 border-amber-500/40">
              NOT GENERATED
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Zero-Knowledge Emergency Recovery Kit: If you lose your laptop, phone, or 2FA device, enter one of these 10 offline single-use codes to regain instant access and revoke lost sessions.
        </p>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        {generatedCodes.length > 0 ? (
          <div className="space-y-4 p-5 rounded-2xl bg-slate-950 border border-amber-500/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                ⚠️ Save These 10 Single-Use Backup Codes (Shown Once):
              </span>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopy} className="text-xs font-bold h-8 border-slate-700">
                  Copy All
                </Button>
                <Button size="sm" onClick={handleDownload} className="text-xs font-bold h-8 bg-amber-600 hover:bg-amber-500 text-white">
                  Download .TXT
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {generatedCodes.map((code, idx) => (
                <div key={idx} className="p-2.5 rounded-xl bg-black/60 border border-slate-800 font-mono text-xs font-bold text-amber-300 text-center tracking-widest select-all">
                  <span className="text-slate-500 mr-2">{idx + 1}.</span>
                  {code}
                </div>
              ))}
            </div>

            <p className="text-[11px] text-slate-400 text-center">
              🔒 Stored in database ONLY as bcrypt salted hashes. Even if Neon or Vercel is breached, plaintext codes cannot be derived.
            </p>
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-secondary/30 border border-card-border">
            <div>
              <p className="text-xs font-bold text-foreground">
                {statusData?.configured ? `Active Recovery Pool: ${statusData.remainingCodes} Unused Codes Available` : "No Emergency Backup Codes Active"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Generating fresh codes will permanently invalidate any previously generated batch.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={generating}
              className="bg-gradient-to-r from-amber-600 to-yellow-600 hover:from-amber-500 hover:to-yellow-500 text-white font-extrabold text-xs h-10 px-5 rounded-xl shadow-lg shrink-0"
            >
              {generating ? "Generating Hashes..." : "Generate 10 Emergency Recovery Codes 🛡️"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ActiveSessionsCard() {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: sessionsData, refetch } = useQuery<{
    sessions: Array<{
      id: number;
      deviceId: string | null;
      platform: string;
      ip: string | null;
      userAgent: string | null;
      createdAt: string;
      expiresAt: string;
    }>;
    count: number;
    currentSessionIp: string;
  }>({
    queryKey: ["/api/admin/sessions"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/sessions")).json(),
  });

  const revokeAllMutation = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/admin/sessions/revoke-others")).json(),
    onSuccess: (data) => {
      toast({ title: "🔒 Sessions Revoked", description: data.message });
      refetch();
      qc.invalidateQueries({ queryKey: ["/api/admin/sessions"] });
    },
    onError: (err: any) => {
      toast({ title: "Revocation Failed", description: err.message, variant: "destructive" });
    },
  });

  const sessions = sessionsData?.sessions || [];
  const count = sessionsData?.count || 0;

  return (
    <Card className="border-sky-500/40 bg-card shadow-xl overflow-hidden">
      <CardHeader className="bg-sky-950/20 border-b border-sky-500/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground font-serif">
            <Monitor className="w-5 h-5 text-sky-400" />
            <span>Active Device Sessions &amp; Token Families</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className="bg-sky-500/20 text-sky-300 border-sky-500/30 text-xs">
              {count} ACTIVE {count === 1 ? "SESSION" : "SESSIONS"}
            </Badge>
            {count > 1 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={() => revokeAllMutation.mutate()}
                disabled={revokeAllMutation.isPending}
                className="text-xs font-bold h-8 px-3 rounded-lg"
              >
                {revokeAllMutation.isPending ? "Revoking..." : "Revoke All Other Devices 🔒"}
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Monitor connected devices and refresh-token families. 10-minute idle timeout &amp; absolute 12-hour session rotation enforced.
        </p>
      </CardHeader>

      <CardContent className="p-5 space-y-3">
        {sessions.length > 0 ? (
          <div className="divide-y divide-border/60 rounded-2xl border border-border/80 bg-secondary/10 overflow-hidden">
            {sessions.map((s, i) => (
              <div key={s.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-7 h-7 rounded-lg bg-card border border-border flex items-center justify-center text-sky-400 shrink-0 font-mono text-[10px] font-bold">
                    #{i + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-foreground truncate flex items-center gap-2">
                      <span>IP: {s.ip || "Unknown"}</span>
                      {s.ip === sessionsData?.currentSessionIp && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold">
                          CURRENT DEVICE
                        </span>
                      )}
                    </p>
                    <p className="text-[10px] text-muted-foreground font-mono mt-0.5 truncate max-w-md">
                      Issued: {new Date(s.createdAt).toLocaleString()} • {s.userAgent?.slice(0, 50) || "Browser Session"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No active sessions found.</p>
        )}
      </CardContent>
    </Card>
  );
}

function AuditHashChainCard() {
  const { data: chainData, refetch, isFetching } = useQuery<{
    valid: boolean;
    brokenAt?: number;
    verifiedCount: number;
    timestamp: string;
  }>({
    queryKey: ["/api/admin/security/audit-chain/verify"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/security/audit-chain/verify")).json(),
  });

  return (
    <Card className="border-indigo-500/40 bg-card shadow-xl overflow-hidden">
      <CardHeader className="bg-indigo-950/20 border-b border-indigo-500/20 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base text-foreground font-serif">
            <ShieldCheck className="w-5 h-5 text-indigo-400" />
            <span>Layer 4: Cryptographic Audit Log Hash Chain (HMAC-SHA256)</span>
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={chainData?.valid ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono text-xs" : "bg-red-500/20 text-red-400 border-red-500/30 font-mono text-xs"}>
              {chainData?.valid ? `🟢 100% INTACT (${chainData?.verifiedCount || 0} EVENTS)` : `🚨 BROKEN AT RECORD #${chainData?.brokenAt}`}
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => refetch()}
              disabled={isFetching}
              className="text-xs font-bold h-8 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/10 cursor-pointer"
            >
              {isFetching ? "Verifying Chain..." : "Re-Verify Chain 🔍"}
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Every audit event is cryptographically linked to the previous event: <code>event_hash = HMAC-SHA256(audit_key, prev_hash + payload)</code>. If an attacker gains raw database access and alters or deletes a single row, the entire chain breaks and alerts the system.
        </p>
      </CardHeader>

      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/10 space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">Cryptographic Status</span>
            <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
              <span>{chainData?.valid ? "🛡️ Untampered & Verified" : "⚠️ Integrity Alert"}</span>
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/10 space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">Verified Chain Depth</span>
            <p className="text-sm font-mono font-bold text-foreground">
              {chainData?.verifiedCount ?? "Scanning..."} Sequential Blocks
            </p>
          </div>
          <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-950/10 space-y-1">
            <span className="text-[10px] uppercase font-mono font-bold text-indigo-400">Chaining Algorithm</span>
            <p className="text-xs font-mono font-bold text-indigo-300">
              HMAC-SHA256 + Nonce Chaining
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950 border border-indigo-500/20 font-mono text-[11px] text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-indigo-400 font-bold">Genesis Node:</span>
            <span className="text-slate-400"><code>0xGENESIS_ROOT</code></span>
            <span>➔</span>
            <span className="text-indigo-400 font-bold">Latest Hash Node:</span>
            <span className="text-emerald-400"><code>HMAC_CHAIN_HEAD</code></span>
          </div>
          <span className="text-[10px] text-slate-500">
            Last Checked: {chainData?.timestamp ? new Date(chainData.timestamp).toLocaleTimeString() : "Just now"}
          </span>
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

  // 1. Super Admin Security Bot State
  const [secBotToken, setSecBotToken] = useState("");
  const [secChatIdList, setSecChatIdList] = useState<string[]>([""]);

  // 2. Grievance & Customer Support Bot State
  const [grievBotToken, setGrievBotToken] = useState("");
  const [grievChatIdList, setGrievChatIdList] = useState<string[]>([""]);

  const { data: telegramData, refetch: refetchTelegram } = useQuery({
    queryKey: ["/api/admin/security/telegram"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/admin/security/telegram");
      return res.json();
    },
  });

  useEffect(() => {
    if (telegramData) {
      // 1. Security Bot
      if (telegramData.security?.botToken && !telegramData.security.botToken.includes("...")) {
        setSecBotToken(telegramData.security.botToken);
      }
      const rawSecIds = telegramData.security?.chatIds || telegramData.security?.chatId || telegramData.chatIds || telegramData.chatId || "";
      if (rawSecIds) {
        const secList = String(rawSecIds).split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
        if (secList.length > 0) {
          setSecChatIdList(secList);
        }
      }

      // 2. Grievance Bot
      if (telegramData.grievance?.botToken && !telegramData.grievance.botToken.includes("...")) {
        setGrievBotToken(telegramData.grievance.botToken);
      }
      const rawGrievIds = telegramData.grievance?.chatIds || telegramData.grievance?.chatId || "";
      if (rawGrievIds) {
        const grievList = String(rawGrievIds).split(/[\n,;]+/).map((s: string) => s.trim()).filter(Boolean);
        if (grievList.length > 0) {
          setGrievChatIdList(grievList);
        }
      }
    }
  }, [telegramData]);

  function handleAddSecChatId() {
    setSecChatIdList((prev) => [...prev, ""]);
  }

  function handleUpdateSecChatId(index: number, val: string) {
    setSecChatIdList((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function handleRemoveSecChatId(index: number) {
    setSecChatIdList((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  }

  function handleAddChatId() {
    setGrievChatIdList((prev) => [...prev, ""]);
  }

  function handleUpdateChatId(index: number, val: string) {
    setGrievChatIdList((prev) => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  }

  function handleRemoveChatId(index: number) {
    setGrievChatIdList((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [""];
    });
  }

  // Mutations for Security Bot
  const saveSecTelegramMutation = useMutation({
    mutationFn: async (payload: { botToken: string; chatId?: string; chatIds?: string }) => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/security", payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      refetchTelegram();
      toast({ title: "🛡️ Super Admin Security Credentials Saved!" });
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err?.message || "Failed to save Security credentials", variant: "destructive" });
    },
  });

  const broadcastUpdateMutation = useMutation({
    mutationFn: async (payload: { version: string; details?: string }) => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/broadcast-update", payload);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "🚀 Update Alert Broadcasted!", description: data?.message || "All Super Admins notified via Telegram." });
    },
    onError: (err: any) => {
      toast({ title: "Broadcast Failed", description: err?.message || "Could not send broadcast", variant: "destructive" });
    },
  });

  const setupSecWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/security/setup-webhook");
      return res.json();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      toast({ title: "✨ Security Webhook Registered!", description: res.message });
    },
    onError: (err: any) => toast({ title: "Webhook Registration Error", description: err.message, variant: "destructive" }),
  });

  const testSecAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/security/test-alert");
      return res.json();
    },
    onSuccess: (res) => toast({ title: "🔔 Security Alert Sent!", description: res.message }),
    onError: (err: any) => toast({ title: "Alert Failed", description: err.message, variant: "destructive" }),
  });

  // Mutations for Grievance Bot
  const saveGrievTelegramMutation = useMutation({
    mutationFn: async (payload: { botToken: string; chatIds: string }) => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/grievance", payload);
      return res.json();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      toast({ title: "🎫 Grievance Bot Saved", description: res.message });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const setupGrievWebhookMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/grievance/setup-webhook");
      return res.json();
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/security/telegram"] });
      toast({ title: "✨ Grievance Webhook Registered!", description: res.message });
    },
    onError: (err: any) => toast({ title: "Webhook Registration Error", description: err.message, variant: "destructive" }),
  });

  const testGrievAlertMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/security/telegram/grievance/test-alert");
      return res.json();
    },
    onSuccess: (res) => toast({ title: "🔔 Support Alert Sent!", description: res.message }),
    onError: (err: any) => toast({ title: "Alert Failed", description: err.message, variant: "destructive" }),
  });

  const eventBadgeColor = (type: string) => {
    if (type.includes("failed") || type.includes("lockdown_on")) return "destructive";
    if (type.includes("rate_limit")) return "outline";
    if (type.includes("success") || type.includes("lockdown_off")) return "default";
    return "secondary";
  };

  const [incidentSearch, setIncidentSearch] = useState("");
  const [copiedRef, setCopiedRef] = useState<string | null>(null);

  const copyIncidentRef = (ref: string) => {
    navigator.clipboard.writeText(ref);
    setCopiedRef(ref);
    toast({ title: "Copied!", description: `Reference ${ref} copied to clipboard.` });
    setTimeout(() => setCopiedRef(null), 2000);
  };

  const threatIncidents = (auditData?.logs || []).filter((log: any) => {
    const isThreat =
      log.eventType === "master_credential_intercepted" ||
      log.eventType === "threat_interception" ||
      (log.actionTaken && log.actionTaken.includes("[SEC-"));
    if (!isThreat) return false;
    if (!incidentSearch.trim()) return true;
    const q = incidentSearch.toLowerCase().trim();
    return (
      (log.actionTaken && log.actionTaken.toLowerCase().includes(q)) ||
      (log.ip && log.ip.toLowerCase().includes(q)) ||
      (log.email && log.email.toLowerCase().includes(q))
    );
  });

  const generalAuditLogs = (auditData?.logs || []).filter((log: any) => {
    const isThreat =
      log.eventType === "master_credential_intercepted" ||
      log.eventType === "threat_interception" ||
      (log.actionTaken && log.actionTaken.includes("[SEC-"));
    return !isThreat;
  });

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

      {/* 👑 Chief Executive Admin Exclusive Mode Controls (Stealth Gateway & Staff 2FA Toggles) */}
      <ChiefExecutiveExclusiveControls />

      {/* Chief Admin 2FA TOTP & Passkeys */}
      <ChiefAdminTotpCard />

      {/* 🔑 Mandatory Root WebAuthn / FIDO2 Hardware Passkeys */}
      <WebAuthnPasskeysCard />

      {/* Super Admin Password Change with TOTP & Old Password Validation */}
      <SuperAdminPasswordUpdateCard />

      {/* Chief Super Admin Offline Break-Glass Emergency Recovery Codes */}
      <EmergencyBreakGlassCodesCard />

      {/* 📱 Active Device Sessions & Token Families */}
      <ActiveSessionsCard />

      {/* ⛓️ Cryptographic Audit Log Hash Chain Verification */}
      <AuditHashChainCard />

      {/* 1. Super Admin Security Bot Controller */}
      <Card className="border-red-500/30 bg-card shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-red-950/40 via-card to-card border-b border-red-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground font-serif">
              <span className="text-xl">🛡️</span> Super Admin Security Bot (Private • Super Admin Control)
            </CardTitle>
            <Badge variant={telegramData?.security?.configured ? "default" : "outline"} className={telegramData?.security?.configured ? "bg-red-500/20 text-red-400 border-red-500/30" : ""}>
              {telegramData?.security?.configured ? "🟢 Security Bot Connected" : "⚠️ Security Token & Chat ID Required"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <strong>Super Admin Ganesh Varma Only.</strong> Sends high-priority security alerts (unauthorized logins, brute force, secret passage requests) and executes platform commands (<code>/lock on</code>, <code>/lock off</code>, <code>/approve</code>, <code>/subadmin block</code>).
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="sec-bot-token" className="text-xs font-bold text-red-400">Security Bot Token (from @BotFather)</Label>
              <Input
                id="sec-bot-token"
                type="password"
                placeholder={telegramData?.security?.configured ? "•••••••••••••••• (Saved. Type to change)" : "e.g. 7123456789:AAFx..."}
                value={secBotToken}
                onChange={(e) => setSecBotToken(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl border-red-500/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Create a private bot on Telegram @BotFather by sending <code>/newbot</code></p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-red-400">
                  Chief Executive Super Admin Chat IDs ({secChatIdList.filter((s) => s.trim()).length} Authorized)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddSecChatId}
                  className="border-red-500/40 text-red-400 hover:bg-red-500/10 text-[11px] h-7 px-2.5 rounded-lg font-bold gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Telegram Chat ID
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {secChatIdList.map((chatIdVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder={`Admin Chat ID #${idx + 1} (e.g. 1927711332)`}
                        value={chatIdVal}
                        onChange={(e) => handleUpdateSecChatId(idx, e.target.value)}
                        className="font-mono text-xs rounded-xl border-red-500/30 pl-3 pr-8"
                      />
                    </div>
                    {secChatIdList.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveSecChatId(idx)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg shrink-0 cursor-pointer"
                        title="Remove Admin Chat ID"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Click <strong>+ Add Admin Chat ID</strong> to authorize additional sub-super-admins to receive security alerts &amp; execute bot commands.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => {
                const cleanJoined = secChatIdList.map((s) => s.trim()).filter(Boolean).join(", ");
                saveSecTelegramMutation.mutate({ botToken: secBotToken, chatIds: cleanJoined });
              }}
              disabled={saveSecTelegramMutation.isPending}
              className="bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold rounded-xl text-xs py-4 px-5 shadow-lg cursor-pointer"
            >
              {saveSecTelegramMutation.isPending ? "Saving..." : "💾 Save Security Credentials"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setupSecWebhookMutation.mutate()}
              disabled={setupSecWebhookMutation.isPending || !telegramData?.security?.configured}
              className="border-red-500/40 text-red-400 hover:bg-red-500/10 font-bold rounded-xl text-xs py-4 px-5 cursor-pointer"
            >
              {setupSecWebhookMutation.isPending ? "Registering..." : "⚡ Auto-Register Security Webhook"}
            </Button>

            <Button
              variant="outline"
              onClick={() => testSecAlertMutation.mutate()}
              disabled={testSecAlertMutation.isPending || !telegramData?.security?.configured}
              className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10 font-bold rounded-xl text-xs py-4 px-5 cursor-pointer"
            >
              {testSecAlertMutation.isPending ? "Sending..." : "🔔 Send Test Security Alert"}
            </Button>

            <Button
              variant="outline"
              onClick={() => broadcastUpdateMutation.mutate({ version: "v10.0.0" })}
              disabled={broadcastUpdateMutation.isPending || !telegramData?.security?.configured}
              className="border-purple-500/40 text-purple-400 hover:bg-purple-500/10 font-bold rounded-xl text-xs py-4 px-5 cursor-pointer"
            >
              {broadcastUpdateMutation.isPending ? "Broadcasting..." : "🚀 Broadcast Update Go-Live"}
            </Button>
          </div>

          {/* Quick Security Commands Guide */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-red-500/20 text-xs space-y-2">
            <p className="font-bold text-red-400 flex items-center gap-1.5">
              <span>📱 Super Admin Control Commands (Send to Security Bot):</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-red-400 font-bold block">/lock on [reason]</span>
                <span className="text-muted-foreground text-[10px]">Turn on emergency lockdown</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/lock off</span>
                <span className="text-muted-foreground text-[10px]">Deactivate platform lockdown</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-amber-400 font-bold block">/approve &lt;token&gt;</span>
                <span className="text-muted-foreground text-[10px]">Approve secret passage unlock</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-red-400 font-bold block">/subadmin block &lt;email&gt;</span>
                <span className="text-muted-foreground text-[10px]">Instantly block rogue sub-admin</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-indigo-400 font-bold block">/flush sessions</span>
                <span className="text-muted-foreground text-[10px]">Revoke all active logins</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-blue-400 font-bold block">/status or /users</span>
                <span className="text-muted-foreground text-[10px]">Live system & user metrics</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Grievance & Customer Support Bot Controller */}
      <Card className="border-emerald-500/30 bg-card shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-emerald-950/40 via-card to-card border-b border-emerald-500/20">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg text-foreground font-serif">
              <span className="text-xl">🎫</span> Grievance &amp; Customer Support Bot (Multi-Admin • Support Team)
            </CardTitle>
            <Badge variant={telegramData?.grievance?.configured ? "default" : "outline"} className={telegramData?.grievance?.configured ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : ""}>
              {telegramData?.grievance?.configured ? "🟢 Support Bot Connected" : "⚠️ Support Token & Chat IDs Required"}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            <strong>For Customer Support Reps &amp; Grievance Officers.</strong> Receives new support ticket notifications and Live Chat escalation requests. <em>Security and platform control commands are strictly disabled on this bot.</em>
          </p>
        </CardHeader>

        <CardContent className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="griev-bot-token" className="text-xs font-bold text-emerald-500">Support / Grievance Bot Token (from @BotFather)</Label>
              <Input
                id="griev-bot-token"
                type="password"
                placeholder={telegramData?.grievance?.configured ? "•••••••••••••••• (Saved. Type to change)" : "e.g. 8123456789:BBFx..."}
                value={grievBotToken}
                onChange={(e) => setGrievBotToken(e.target.value)}
                className="mt-1 font-mono text-xs rounded-xl border-emerald-500/30"
              />
              <p className="text-[10px] text-muted-foreground mt-1">Create a distinct support bot on Telegram @BotFather by sending <code>/newbot</code></p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-emerald-500">
                  Grievance / Staff Chat IDs ({grievChatIdList.filter((s) => s.trim()).length} Configured)
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddChatId}
                  className="border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 text-[11px] h-7 px-2.5 rounded-lg font-bold gap-1 cursor-pointer"
                >
                  <Plus size={13} /> Add Chat ID
                </Button>
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {grievChatIdList.map((chatIdVal, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Input
                        type="text"
                        placeholder={`Staff Chat ID #${idx + 1} (e.g. 1927711332 or -100...)`}
                        value={chatIdVal}
                        onChange={(e) => handleUpdateChatId(idx, e.target.value)}
                        className="font-mono text-xs rounded-xl border-emerald-500/30 pl-3 pr-8"
                      />
                    </div>
                    {grievChatIdList.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveChatId(idx)}
                        className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg shrink-0 cursor-pointer"
                        title="Remove Chat ID"
                      >
                        <Trash2 size={14} />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">
                Click <strong>+ Add Chat ID</strong> to add individual staff members or Telegram Group IDs (starting with <code>-100...</code>).
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              onClick={() => {
                const cleanJoined = grievChatIdList.map((s) => s.trim()).filter(Boolean).join(", ");
                saveGrievTelegramMutation.mutate({ botToken: grievBotToken, chatIds: cleanJoined });
              }}
              disabled={saveGrievTelegramMutation.isPending}
              className="bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold rounded-xl text-xs py-4 px-5 shadow-lg cursor-pointer"
            >
              {saveGrievTelegramMutation.isPending ? "Saving..." : "💾 Save Grievance Credentials"}
            </Button>

            <Button
              variant="outline"
              onClick={() => setupGrievWebhookMutation.mutate()}
              disabled={setupGrievWebhookMutation.isPending || !telegramData?.grievance?.configured}
              className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10 font-bold rounded-xl text-xs py-4 px-5 cursor-pointer"
            >
              {setupGrievWebhookMutation.isPending ? "Registering..." : "⚡ Auto-Register Grievance Webhook"}
            </Button>

            <Button
              variant="outline"
              onClick={() => testGrievAlertMutation.mutate()}
              disabled={testGrievAlertMutation.isPending || !telegramData?.grievance?.configured}
              className="border-teal-500/40 text-teal-400 hover:bg-teal-500/10 font-bold rounded-xl text-xs py-4 px-5 cursor-pointer"
            >
              {testGrievAlertMutation.isPending ? "Sending..." : "🔔 Send Test Support Alert"}
            </Button>
          </div>

          {/* Quick Grievance Commands Guide */}
          <div className="p-3.5 rounded-xl bg-secondary/30 border border-emerald-500/20 text-xs space-y-2">
            <p className="font-bold text-emerald-400 flex items-center gap-1.5">
              <span>📋 Support Bot Features &amp; Commands:</span>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px] font-mono">
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/tickets</span>
                <span className="text-muted-foreground text-[10px]">View list of open support tickets</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/ticket &lt;id&gt;</span>
                <span className="text-muted-foreground text-[10px]">Inspect full customer ticket</span>
              </div>
              <div className="bg-background/80 p-2 rounded-lg border border-card-border">
                <span className="text-emerald-400 font-bold block">/resolve &lt;id&gt; [note]</span>
                <span className="text-muted-foreground text-[10px]">Mark ticket solved from Telegram</span>
              </div>
            </div>
            <p className="text-[11px] text-amber-500/90 font-medium pt-1">
              🔒 <strong>Security Policy:</strong> System control commands (<code>/lock</code>, <code>/approve</code>, <code>/block</code>, etc.) are strictly rejected in this bot to prevent unauthorized control of the website.
            </p>
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

      {/* Dedicated Security Incident & Threat Interceptions Log */}
      <Card className="border-red-500/40 bg-card shadow-xl overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-red-950/40 via-card to-card border-b border-red-500/20">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-foreground font-serif text-lg">
                <ShieldAlert className="w-5 h-5 text-red-500 animate-pulse" />
                <span>Intercepted Threats &amp; Security Incident Log</span>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Real-time record of quarantined credential attacks, stealth gateway interceptions, and security policy enforcements.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search Incident Ref (e.g. SEC-1GAOP7)..."
                  value={incidentSearch}
                  onChange={(e) => setIncidentSearch(e.target.value)}
                  className="h-8 pl-8 text-xs font-mono rounded-lg border-red-500/30 bg-background/80"
                />
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => qc.invalidateQueries({ queryKey: ["/api/admin/security/audit-log"] })}
                className="h-8 border-red-500/30 hover:bg-red-500/10 text-xs px-2.5 rounded-lg text-red-400 gap-1 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0 sm:p-4">
          <Table>
            <TableHeader className="bg-secondary/30">
              <TableRow>
                <TableHead className="text-xs font-bold text-red-400">Incident Reference</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Threat Type &amp; Details</TableHead>
                <TableHead className="text-xs font-bold text-foreground">IP Address</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Status</TableHead>
                <TableHead className="text-xs font-bold text-foreground">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {threatIncidents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">
                    {incidentSearch ? `No threat incidents matching "${incidentSearch}"` : "No threat incidents recorded yet. System defenses operational."}
                  </TableCell>
                </TableRow>
              ) : (
                threatIncidents.map((log: any) => {
                  const refMatch = log.actionTaken?.match(/\[(SEC-[A-Z0-9]+-\d+)\]/);
                  const incidentRef = refMatch ? refMatch[1] : (log.actionTaken?.includes("[") ? log.actionTaken.split("]")[0].replace("[", "") : `SEC-LOG-${log.id}`);
                  const detailText = log.actionTaken ? log.actionTaken.replace(/\[SEC-[A-Z0-9]+-\d+\]\s*/, "") : "Master Credentials Intercepted";

                  return (
                    <TableRow key={log.id} className="hover:bg-red-950/20 transition-colors border-b border-red-500/10">
                      <TableCell className="font-mono text-xs">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="destructive" className="font-mono font-bold bg-red-900/60 text-red-200 border-red-500/40 text-[11px] px-2 py-0.5 shadow-sm">
                            {incidentRef}
                          </Badge>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyIncidentRef(incidentRef)}
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground cursor-pointer"
                            title="Copy Incident Reference"
                          >
                            {copiedRef === incidentRef ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs max-w-xs">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-foreground">{log.eventType === "master_credential_intercepted" ? "Master Credentials Intercepted" : log.eventType}</p>
                          <p className="text-[11px] text-muted-foreground leading-tight">{detailText}</p>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{log.ip || "—"}</TableCell>
                      <TableCell>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] uppercase tracking-wider font-bold">
                          Quarantined &amp; Blocked
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* General System & Auth Audit Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>General System Audit Log</span>
            <span className="text-xs font-normal text-muted-foreground">({generalAuditLogs.length} events)</span>
          </CardTitle>
        </CardHeader>
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
              {generalAuditLogs.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No audit events yet</TableCell></TableRow>
              ) : (
                generalAuditLogs.map((log: any) => (
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
