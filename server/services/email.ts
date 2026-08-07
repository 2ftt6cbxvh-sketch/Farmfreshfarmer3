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

export async function sendRealEmail(opts: SendEmailOptions): Promise<boolean> {
  const { to, subject, html } = opts;
  const creds = await getSmtpCredentials();

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
          from: creds.fromEmail || "FarmFreshFarmer <no-reply@resend.dev>",
          to: [to],
          subject,
          html,
        }),
      });

      if (res.ok) {
        console.log(`[EMAIL DISPATCHED VIA RESEND] To: ${to} | Subject: ${subject}`);
        return true;
      } else {
        const err = await res.json();
        console.error("[EMAIL RESEND FAILED]", err);
      }
    } catch (e) {
      console.error("[EMAIL RESEND ERROR]", e);
    }
  }

  // 2. Check if SMTP Transport is configured (Gmail / Resend / SendGrid / AWS SES)
  if (creds.smtpHost && creds.smtpUser && creds.smtpPass) {
    try {
      // @ts-ignore - nodemailer loaded dynamically
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: creds.smtpHost,
        port: parseInt(creds.smtpPort || "587", 10),
        secure: creds.smtpPort === "465",
        auth: {
          user: creds.smtpUser,
          pass: creds.smtpPass,
        },
      });

      await transporter.sendMail({
        from: creds.fromEmail || `"FarmFreshFarmer" <${creds.smtpUser}>`,
        to,
        subject,
        html,
      });

      console.log(`[EMAIL DISPATCHED VIA SMTP] To: ${to} | Subject: ${subject}`);
      return true;
    } catch (e) {
      console.error("[EMAIL SMTP ERROR]", e);
    }
  }

  // 3. Fallback: Log to console in development mode
  console.log(`[DEV MODE EMAIL PREVIEW] To: ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`HTML Preview:\n${html}`);
  return false;
}

/** Helper: Generate HTML Template for OTP Code Email */
export function buildOtpEmailHtml(otpCode: string, name = "Valued Customer"): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; background-color: #092615; color: #ffffff; padding: 32px; border-radius: 24px; border: 1px solid #15803d;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #86efac; font-size: 26px; margin: 0; font-family: Georgia, serif;">🌿 FarmFreshFarmer</h1>
        <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Organic · Farm to Home</p>
      </div>

      <div style="background-color: #0f172a; padding: 24px; border-radius: 16px; border: 1px solid #334155; text-align: center; margin-bottom: 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Your Verification OTP Code</h2>
        <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Hello ${name}, use the 6-digit code below to complete your authentication:</p>

        <div style="background-color: #15803d; color: #ffffff; font-size: 32px; font-weight: bold; letter-spacing: 8px; padding: 16px; border-radius: 12px; display: inline-block; font-family: monospace;">
          ${otpCode}
        </div>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">This OTP code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>

      <div style="text-align: center; color: #64748b; font-size: 12px;">
        <p>© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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
