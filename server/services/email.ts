/**
 * Production Email Delivery Service for FarmFreshFarmer.
 * Integrates Resend API / SMTP (Nodemailer) to dispatch real emails for:
 *   1. Email 6-Digit OTP Login & Verification
 *   2. Password Reset Links & Codes
 *   3. Order Confirmations
 * Dynamically reads credentials from process.env OR DB storage.settings.
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function getSmtpCredentials(): Promise<{
  resendApiKey: string;
  smtpHost: string;
  smtpPort: string;
  smtpUser: string;
  smtpPass: string;
  fromEmail: string;
}> {
  const envResend = process.env.RESEND_API_KEY || "";
  const envHost = process.env.SMTP_HOST || "";
  const envPort = process.env.SMTP_PORT || "587";
  const envUser = process.env.SMTP_USER || "";
  const envPass = process.env.SMTP_PASS || "";
  const envFrom = process.env.FROM_EMAIL || process.env.EMAIL_FROM || "";

  // Try loading DB settings
  try {
    const { storage } = await import("../storage");
    const dbResend = await storage.settings.get("resend_api_key");
    const dbHost = await storage.settings.get("smtp_host");
    const dbPort = await storage.settings.get("smtp_port");
    const dbUser = await storage.settings.get("smtp_user");
    const dbPass = await storage.settings.get("smtp_pass");
    const dbFrom = await storage.settings.get("from_email");

    const user = dbUser || envUser;
    return {
      resendApiKey: dbResend || envResend,
      smtpHost: dbHost || envHost,
      smtpPort: dbPort || envPort,
      smtpUser: user,
      smtpPass: dbPass || envPass,
      fromEmail: dbFrom || envFrom || (user ? `FarmFreshFarmer <${user}>` : "orders@farmfreshfarmer.com"),
    };
  } catch {
    return {
      resendApiKey: envResend,
      smtpHost: envHost,
      smtpPort: envPort,
      smtpUser: envUser,
      smtpPass: envPass,
      fromEmail: envFrom || (envUser ? `FarmFreshFarmer <${envUser}>` : "orders@farmfreshfarmer.com"),
    };
  }
}

export async function sendRealEmailWithResult(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const creds = await getSmtpCredentials();
  const { to, subject, html } = opts;

  // 1. Check if Resend API Key is configured
  if (creds.resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: creds.fromEmail || "FarmFreshFarmer <orders@farmfreshfarmer.com>",
          to: [to],
          subject,
          html,
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL DISPATCHED VIA RESEND] To: ${to} | Subject: ${subject}`);
        return { success: true };
      } else {
        const err = await res.json();
        console.error("[EMAIL RESEND FAILED]", err);
        return { success: false, error: `Resend API Error: ${err.message || JSON.stringify(err)}` };
      }
    } catch (e: any) {
      console.error("[EMAIL RESEND ERROR]", e);
      return { success: false, error: `Resend API Error: ${e.message}` };
    }
  }

  // 2. Check if SMTP Transport is configured (Titan Email / GoDaddy / Gmail / Resend SMTP)
  if (creds.smtpHost && creds.smtpUser && creds.smtpPass) {
    try {
      // @ts-ignore - nodemailer loaded dynamically
      const nodemailer = await import("nodemailer");
      const port = parseInt(creds.smtpPort || "587", 10);
      const transporter = nodemailer.createTransport({
        host: creds.smtpHost.trim(),
        port,
        secure: port === 465,
        auth: {
          user: creds.smtpUser.trim(),
          pass: creds.smtpPass.trim(),
        },
        tls: {
          rejectUnauthorized: false,
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });

      await transporter.sendMail({
        from: creds.fromEmail || `"FarmFreshFarmer" <${creds.smtpUser.trim()}>`,
        to,
        subject,
        html,
      });

      console.log(`[EMAIL DISPATCHED VIA SMTP] To: ${to} | Subject: ${subject}`);
      return { success: true };
    } catch (e: any) {
      console.error("[EMAIL SMTP ERROR]", e);
      return { success: false, error: e.message || "SMTP connection failed" };
    }
  }

  // 3. Fallback: Log to console in development mode
  console.log(`[DEV MODE EMAIL PREVIEW] To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`HTML Preview:\n${html}`);
  return { success: false, error: "Missing SMTP credentials. Please fill in SMTP Host, Username & Password and click Save." };
}

export async function sendRealEmail(opts: SendEmailOptions): Promise<boolean> {
  const res = await sendRealEmailWithResult(opts);
  return res.success;
}

/** Helper: Generate HTML Template for OTP Code Email */
export function buildOtpEmailHtml(otpCode: string, name = "Valued Customer"): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 580px; margin: 0 auto; background-color: #061c10; color: #ffffff; padding: 36px 28px; border-radius: 24px; border: 1px solid #16a34a; box-shadow: 0 10px 25px rgba(0,0,0,0.5);">
      <div style="text-align: center; margin-bottom: 28px;">
        <h1 style="color: #4ade80; font-size: 28px; margin: 0; font-family: Georgia, serif; font-weight: bold;">🌿 FarmFreshFarmer</h1>
        <p style="color: #a7f3d0; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-top: 6px; font-weight: 600;">Fresh Organic Produce · Directly From Local Farmers</p>
      </div>

      <div style="background-color: #0f172a; padding: 28px 24px; border-radius: 20px; border: 1px solid #334155; text-align: center; margin-bottom: 24px;">
        <h2 style="color: #ffffff; font-size: 22px; margin-top: 0; font-weight: bold;">Your Verification Code (OTP)</h2>
        <p style="color: #e2e8f0; font-size: 15px; margin-bottom: 24px; line-height: 1.6;">
          Hello <strong style="color: #4ade80;">${name}</strong>,<br/>
          Welcome to <strong>FarmFreshFarmer</strong>! Use the 6-digit One-Time Password (OTP) below to authorize your account action:
        </p>

        <div style="background-color: #15803d; color: #ffffff; font-size: 36px; font-weight: 900; letter-spacing: 10px; padding: 18px 28px; border-radius: 16px; display: inline-block; font-family: 'Courier New', monospace; box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);">
          ${otpCode}
        </div>

        <p style="color: #94a3b8; font-size: 13px; margin-top: 20px; line-height: 1.5;">
          ⏱️ This OTP code is valid for <strong>10 minutes</strong>.<br/>
          🔒 For your security, never share this code with anyone, including FarmFresh staff.
        </p>
      </div>

      <div style="background-color: #092615; padding: 16px 20px; border-radius: 14px; border: 1px solid #15803d; margin-bottom: 24px; text-align: left;">
        <p style="color: #86efac; font-size: 12px; margin: 0 0 6px 0; font-weight: bold;">🛡️ Security Notice:</p>
        <p style="color: #cbd5e1; font-size: 11px; margin: 0; line-height: 1.5;">
          If you did not request this OTP code or attempt to log in to FarmFreshFarmer, please ignore this email or reach out to our security support team immediately.
        </p>
      </div>

      <div style="text-align: center; color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 20px;">
        <p style="margin: 0 0 6px 0;">Need help? Visit <a href="https://farmfreshfarmer.com" style="color: #4ade80; text-decoration: none;">farmfreshfarmer.com</a> or contact support.</p>
        <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer Inc. All rights reserved.</p>
      </div>
    </div>
  `;
}

/** Helper: Generate HTML Template for Password Reset Link */
export function buildResetPasswordHtml(resetUrl: string, name = "Valued Customer"): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; background-color: #092615; color: #ffffff; padding: 32px; border-radius: 24px; border: 1px solid #15803d;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #86efac; font-size: 26px; margin: 0; font-family: Georgia, serif;">🌿 FarmFreshFarmer</h1>
        <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Security Center</p>
      </div>

      <div style="background-color: #0f172a; padding: 24px; border-radius: 16px; border: 1px solid #334155; text-align: center; margin-bottom: 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Password Reset Requested</h2>
        <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Hello ${name}, click the button below to reset your FarmFreshFarmer account password:</p>

        <a href="${resetUrl}" style="background-color: #15803d; color: #ffffff; font-size: 16px; font-weight: bold; text-decoration: none; padding: 14px 28px; border-radius: 12px; display: inline-block;">
          🔑 Reset My Password
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Or copy and paste this link into your web browser:<br/><span style="color: #38bdf8; word-break: break-all;">${resetUrl}</span></p>
        <p style="color: #94a3b8; font-size: 12px; margin-top: 12px;">This link will expire in <strong>1 hour</strong>.</p>
      </div>

      <div style="text-align: center; color: #64748b; font-size: 12px;">
        <p>© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
      </div>
    </div>
  `;
}
