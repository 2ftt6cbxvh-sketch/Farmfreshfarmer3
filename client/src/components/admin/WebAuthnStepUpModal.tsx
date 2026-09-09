/**
 * WebAuthn / Biometric Step-Up Verification Modal
 * ===============================================
 * Prompts Chief Executive Admin for hardware-bound passkey / biometric
 * verification (Touch ID / Face ID / Windows Hello / YubiKey) before executing
 * high-consequence operations (emergency platform lockdown, high-value refunds,
 * customer data purge, staff permission grants).
 */

import { useState } from "react";
import { Fingerprint, ShieldAlert, CheckCircle2, AlertCircle, X, KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { startAuthentication, browserSupportsWebAuthn } from "@simplewebauthn/browser";

interface WebAuthnStepUpModalProps {
  open: boolean;
  title?: string;
  description?: string;
  actionName?: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export function WebAuthnStepUpModal({
  open,
  title = "Biometric Passkey Step-Up Required",
  description = "This high-consequence administrative action requires cryptographic hardware verification.",
  actionName = "Execute Operation",
  onSuccess,
  onCancel,
}: WebAuthnStepUpModalProps) {
  const { toast } = useToast();
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleTriggerWebAuthn = async () => {
    setError(null);
    setAuthenticating(true);

    try {
      if (!browserSupportsWebAuthn()) {
        throw new Error("This browser does not support WebAuthn / Passkeys. Please use a modern browser.");
      }

      // Step 1: Request authentication challenge options
      const optRes = await apiRequest("POST", "/api/admin/webauthn/auth/options", {});
      const optionsJSON = await optRes.json();

      if (!optionsJSON || !optionsJSON.challenge) {
        throw new Error("Failed to receive WebAuthn challenge from security server.");
      }

      // Step 2: Trigger platform biometric / security key prompt
      let assertionResponse;
      try {
        assertionResponse = await startAuthentication(optionsJSON);
      } catch (authErr: any) {
        if (authErr.name === "NotAllowedError") {
          throw new Error("Biometric verification cancelled or timed out.");
        }
        throw new Error(authErr.message || "Hardware biometric authentication failed.");
      }

      // Step 3: Verify assertion with backend
      const verifyRes = await apiRequest("POST", "/api/admin/webauthn/auth/verify", {
        response: assertionResponse,
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.message || "Passkey signature verification failed.");
      }

      toast({
        title: "🛡️ Hardware Step-Up Verified",
        description: "Cryptographic signature confirmed. Executing administrative action.",
      });

      onSuccess();
    } catch (err: any) {
      console.error("[WebAuthn-StepUp] Error:", err);
      setError(err.message || "Biometric authentication failed.");
    } finally {
      setAuthenticating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-card border border-emerald-500/40 shadow-2xl rounded-3xl p-6 relative overflow-hidden space-y-5">
        {/* Ambient Top Glow */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <button
          onClick={onCancel}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-full bg-background/50 hover:bg-background transition-colors"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <Fingerprint size={26} />
          </div>
          <div>
            <h3 className="text-base font-black text-foreground">{title}</h3>
            <p className="text-[11px] font-mono text-emerald-400 uppercase tracking-wide">
              FIDO2 / WebAuthn Level 3 Step-Up
            </p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>

        <div className="p-3.5 rounded-2xl bg-background/60 border border-border text-xs space-y-2">
          <div className="flex items-center gap-2 text-foreground font-bold">
            <KeyRound size={14} className="text-emerald-400" />
            <span>Cryptographic Target: {actionName}</span>
          </div>
          <p className="text-[11px] text-muted-foreground leading-snug">
            Touch ID, Face ID, Windows Hello, or physical security key will establish a 5-minute verified step-up session.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-start gap-2">
            <AlertCircle size={15} className="shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Verification Incomplete</p>
              <p className="text-[11px] opacity-90">{error}</p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 pt-2">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={authenticating}
            className="flex-1 rounded-xl text-xs font-bold"
          >
            Cancel
          </Button>
          <Button
            onClick={handleTriggerWebAuthn}
            disabled={authenticating}
            className="flex-1 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs shadow-lg shadow-emerald-900/30 flex items-center justify-center gap-1.5"
          >
            {authenticating ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Prompting Sensor...</span>
              </>
            ) : (
              <>
                <Fingerprint size={14} />
                <span>Verify Biometrics</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
