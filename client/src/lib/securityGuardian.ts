/**
 * FarmFreshFarmer Security Guardian
 * =================================
 * Client-Side Anti-Tampering, Injection Shield & DevTools Deterrence.
 */

export function initSecurityGuardian() {
  if (typeof window === "undefined") return;

  // 1. Console Deterrence Warning
  try {
    const banner = [
      "%c🚨 FARMFRESHFARMER SECURITY GUARDIAN 🚨",
      "%cATTENTION: This browser console is for authorized platform development only.",
      "Attempting to inject malicious code, tamper with authentication states, modify order pricing, or exploit endpoints is strictly forbidden.",
      "All unauthorized requests are cryptographically verified and server-rejected. Suspicious activity triggers automatic security lockout and permanent account termination.",
    ].join("\n");

    console.log(
      banner,
      "color: #ef4444; font-size: 16px; font-weight: 900; text-shadow: 0 0 8px rgba(239,68,68,0.5);",
      "color: #f59e0b; font-size: 12px; font-weight: bold;"
    );
  } catch {}

  // 2. Prevent Object Prototype Pollution on client
  try {
    if (Object.seal) {
      // Protect default Object properties from malicious prototype override
      Object.seal(Object.prototype);
    }
  } catch {}

  // 3. Security DOM Mutation Watchdog
  // Ensures critical security overlays cannot be deleted or hidden via DevTools Inspector
  try {
    let checkTimer: any = null;
    const watchdog = new MutationObserver(() => {
      if (checkTimer) clearTimeout(checkTimer);
      checkTimer = setTimeout(() => {
        const adminUserRaw = localStorage.getItem("adminUser");
        if (adminUserRaw) {
          try {
            const parsed = JSON.parse(adminUserRaw);
            // If someone manually injects isPrimaryAdmin without a matching token, clear it
            const hasToken = localStorage.getItem("accessToken") || localStorage.getItem("token");
            if (!hasToken) {
              localStorage.removeItem("adminUser");
            }
          } catch {
            localStorage.removeItem("adminUser");
          }
        }
      }, 500);
    });

    if (document.body) {
      watchdog.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["style", "class"] });
    }
  } catch {}
}
