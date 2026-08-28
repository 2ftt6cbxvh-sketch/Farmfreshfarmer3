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
  text?: string;
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
      fromEmail: dbFrom || envFrom || (user ? `FarmFreshFarmer <${user}>` : "admin@farmfreshfarmer.com"),
    };
  } catch {
    return {
      resendApiKey: envResend,
      smtpHost: envHost,
      smtpPort: envPort,
      smtpUser: envUser,
      smtpPass: envPass,
      fromEmail: envFrom || (envUser ? `FarmFreshFarmer <${envUser}>` : "admin@farmfreshfarmer.com"),
    };
  }
}

export async function sendRealEmailWithResult(opts: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const creds = await getSmtpCredentials();
  const { to, subject, html, text } = opts;

  const plainText = text || html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

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
          from: creds.fromEmail || "FarmFreshFarmer <admin@farmfreshfarmer.com>",
          to: [to],
          reply_to: creds.smtpUser || "assistance.farmfresh@gmail.com",
          subject,
          html,
          text: plainText,
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
      const isSecure = port === 465;
      const transporter = nodemailer.createTransport({
        host: creds.smtpHost.trim(),
        port,
        secure: isSecure,
        auth: {
          user: creds.smtpUser.trim(),
          pass: creds.smtpPass.trim(),
        },
        tls: {
          rejectUnauthorized: false,
          minVersion: "TLSv1.2",
        },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 20000,
      });

      await transporter.sendMail({
        from: creds.fromEmail || `"FarmFreshFarmer" <${creds.smtpUser.trim()}>`,
        to,
        replyTo: creds.smtpUser.trim(),
        subject,
        text: plainText,
        html,
        headers: {
          "X-Entity-Ref-ID": `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          "X-Auto-Response-Suppress": "OOF, AutoReply",
        },
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

/** Helper: Generate Plain Text for OTP Code */
export function buildOtpPlainText(otpCode: string, name = "Valued Customer"): string {
  return `Hello ${name},\n\nYour FarmFreshFarmer verification code is: ${otpCode}\n\nThis OTP is valid for 10 minutes.\nNever share this code with anyone.\n\nFarmFreshFarmer - Fresh Organic Produce\nhttps://farmfreshfarmer.com`;
}

/** Helper: Generate HTML Template for OTP Code Email */
export function buildOtpEmailHtml(otpCode: string, name = "Valued Customer"): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your FarmFreshFarmer Verification Code</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f4f6f8; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #14532d 0%, #15803d 100%); padding: 28px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1px; font-weight: 600;">Fresh Organic Produce</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 18px; color: #1e293b; font-weight: 700;">Account Verification</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                    Hello <strong>${name}</strong>,<br>
                    Use the 6-digit verification code below to complete your authentication:
                  </p>

                  <!-- OTP Code Box -->
                  <div style="text-align: center; margin: 24px 0;">
                    <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #22c55e; border-radius: 12px; padding: 14px 32px; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #15803d;">
                      ${otpCode}
                    </div>
                  </div>

                  <p style="margin: 20px 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                    ⏱️ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">If you did not request this code, you can safely ignore this email.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
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
