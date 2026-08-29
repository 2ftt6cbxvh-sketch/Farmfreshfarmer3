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
  return `Hello ${name},\n\nYour FarmFreshFarmer verification code is: ${otpCode}\n\nThis OTP is valid for 10 minutes.\nNever share this code with anyone.\n\n🛡️ Didn't request this code?\nIf you did not request this OTP, someone may be attempting to access your account. Please contact our support team immediately:\n• Email: assistance.farmfresh@gmail.com / support@farmfreshfarmer.com\n• Helpline & WhatsApp: +91 79897 93669\n\nFarmFreshFarmer - Fresh Organic Produce\nhttps://farmfreshfarmer.com`;
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

                  <!-- OTP Code Box (Red Security Code) -->
                  <div style="text-align: center; margin: 24px 0;">
                    <div style="display: inline-block; background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 12px; padding: 14px 32px; font-family: 'Courier New', monospace; font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.1);">
                      ${otpCode}
                    </div>
                  </div>

                  <p style="margin: 20px 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                    ⏱️ Valid for <strong>10 minutes</strong>. Do not share this code with anyone.
                  </p>

                  <!-- Security Warning & Direct Contact Info -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; margin-top: 24px; text-align: left;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #b91c1c;">
                      🛡️ Didn't request this code?
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
                      If you did not request this OTP, someone may be attempting to access your account. Please reach out to our customer support team immediately:
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" style="margin-top: 8px; font-size: 11px; color: #991b1b;">
                      <tr>
                        <td style="padding: 2px 8px 2px 0; font-weight: 700;">📧 Email:</td>
                        <td><a href="mailto:assistance.farmfresh@gmail.com" style="color: #b91c1c; text-decoration: underline; font-weight: 600;">assistance.farmfresh@gmail.com</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 2px 8px 2px 0; font-weight: 700;">📞 Phone &amp; WhatsApp:</td>
                        <td><a href="tel:+917989793669" style="color: #b91c1c; text-decoration: underline; font-weight: 600;">+91 79897 93669</a></td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Reset Requested</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 32px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Account Security Center</p>
                </td>
              </tr>
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800;">Password Reset Request</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                    Hello <strong>${name}</strong>,<br>
                    We received a request to reset your FarmFreshFarmer account password. Click the button below to choose a new password:
                  </p>
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${resetUrl}" style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px rgba(22,163,74,0.35);">
                      🔑 Reset My Password
                    </a>
                  </div>
                  <p style="margin: 20px 0 0; font-size: 12px; color: #64748b; line-height: 1.5;">
                    Or copy and paste this secure link into your browser:<br/>
                    <a href="${resetUrl}" style="color: #16a34a; word-break: break-all; text-decoration: underline;">${resetUrl}</a>
                  </p>
                  <p style="margin: 12px 0 0; font-size: 12px; color: #64748b;">
                    ⏱️ This reset link is valid for <strong>1 hour</strong>.
                  </p>
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; margin-top: 24px;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #b91c1c;">
                      🛡️ Didn't request a password reset?
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
                      If you did not make this request, someone may be attempting to access your account. Please ignore this email or reach out to our customer support team immediately.
                    </p>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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

/** Helper: Generate Welcome / Account Created Email */
export function buildWelcomeRegistrationEmailHtml(
  name: string,
  email: string,
  meta?: { time?: string; ip?: string; userAgent?: string; platform?: string }
): string {
  const timeStr = meta?.time || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Welcome to FarmFreshFarmer</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Welcome to FarmFreshFarmer! Your account has been created successfully. Explore 100% natural organic farm produce delivered to your doorstep.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 32px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Welcome to the Family</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="margin: 0 0 14px; font-size: 20px; color: #0f172a; font-weight: 800;">Namaste ${name}! 🙏</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                    Your FarmFreshFarmer account (<strong>${email}</strong>) has been created successfully! You now have direct access to 100% chemical-free organic fruits, vegetables, homemade Andhra pickles, and ghee sweets with <strong>instant 30–90 minute delivery</strong> across Vijayawada.
                  </p>

                  <!-- Quick Action Button -->
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="https://farmfreshfarmer.com" style="background: linear-gradient(135deg, #15803d 0%, #16a34a 100%); color: #ffffff; font-size: 15px; font-weight: 800; text-decoration: none; padding: 14px 32px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 14px rgba(22,163,74,0.35);">
                      🛒 Start Shopping Fresh Harvest
                    </a>
                  </div>

                  <!-- Terms & Conditions Summary Box -->
                  <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 18px; margin: 20px 0;">
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 10px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px;">
                      📜 Important Terms of Service &amp; Quality Guarantee:
                    </div>
                    <div style="margin-bottom: 8px; font-size: 12px; color: #334155; line-height: 1.5;">
                      🌱 <strong>100% Chemical-Free Guarantee:</strong> Directly sourced from certified organic farmers across Andhra Pradesh.
                    </div>
                    <div style="margin-bottom: 8px; font-size: 12px; color: #334155; line-height: 1.5;">
                      ⚡ <strong>Express Delivery (30–90 Mins):</strong> Orders are dispatched from local micro-hubs within minutes of morning harvest.
                    </div>
                    <div style="margin-bottom: 8px; font-size: 12px; color: #334155; line-height: 1.5;">
                      🛡️ <strong>2-Hour Doorstep Return:</strong> Perishable items can be returned/refunded within 2 hours of delivery if unsatisfactory.
                    </div>
                    <div style="font-size: 12px; color: #334155; line-height: 1.5;">
                      🔒 <strong>Data Privacy:</strong> Fully protected under the Digital Personal Data Protection (DPDP) Act 2023. We never sell your personal data.
                    </div>
                    <div style="margin-top: 12px; text-align: center; font-size: 11px;">
                      <a href="https://farmfreshfarmer.com/terms" style="color: #16a34a; font-weight: 700; text-decoration: underline; margin: 0 6px;">Full Terms &amp; Conditions</a> • 
                      <a href="https://farmfreshfarmer.com/privacy" style="color: #16a34a; font-weight: 700; text-decoration: underline; margin: 0 6px;">Privacy Policy</a> • 
                      <a href="https://farmfreshfarmer.com/refund" style="color: #16a34a; font-weight: 700; text-decoration: underline; margin: 0 6px;">Refund Policy</a>
                    </div>
                  </div>

                  <!-- Account Details Box -->
                  <div style="background-color: #f1f5f9; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 12px; color: #334155;">
                    <div style="font-weight: 700; color: #0f172a; margin-bottom: 8px;">📋 Account Registration Details:</div>
                    <div style="margin-bottom: 4px;">• <strong>Account Email:</strong> ${email}</div>
                    <div style="margin-bottom: 4px;">• <strong>Created At:</strong> ${timeStr}</div>
                    ${meta?.ip ? `<div style="margin-bottom: 4px;">• <strong>IP Address:</strong> ${meta.ip}</div>` : ""}
                    ${meta?.userAgent ? `<div>• <strong>Device / Browser:</strong> ${meta.userAgent}</div>` : ""}
                  </div>

                  <!-- Security Advisory & Direct Support Notice -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px; margin-top: 24px; text-align: left;">
                    <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
                      <span style="font-size: 15px;">🛡️</span>
                      <strong style="font-size: 13px; color: #b91c1c;">Did you not create this account?</strong>
                    </div>
                    <p style="margin: 0 0 10px; font-size: 12px; color: #7f1d1d; line-height: 1.5;">
                      If this account was not created by you, your email address may have been entered by mistake or unauthorized access occurred. Please update your password immediately in your profile or contact our support team:
                    </p>
                    <table border="0" cellpadding="0" cellspacing="0" style="font-size: 11px; color: #991b1b; width: 100%;">
                      <tr>
                        <td style="padding: 3px 0; font-weight: 700;">📧 Support Email:</td>
                        <td><a href="mailto:admin@farmfreshfarmer.com" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">admin@farmfreshfarmer.com</a> / <a href="mailto:assistance.farmfresh@gmail.com" style="color: #b91c1c; text-decoration: underline;">assistance.farmfresh@gmail.com</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; font-weight: 700;">📞 Phone &amp; WhatsApp:</td>
                        <td><a href="tel:+917989793669" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">+91 79897 93669</a> / <a href="tel:+918555021322" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">+91 85550 21322</a></td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; font-weight: 700;">🔒 Profile Security:</td>
                        <td><a href="https://farmfreshfarmer.com/account" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">farmfreshfarmer.com/account (Update Password)</a></td>
                      </tr>
                    </table>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer Security · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved. Visakhapatnam & Vijayawada, Andhra Pradesh, India.</p>
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

/** Helper: Generate Security Login Alert Email */
export function buildSecurityLoginAlertEmailHtml(
  name: string,
  email: string,
  meta: { time?: string; ip?: string; userAgent?: string; platform?: string }
): string {
  const timeStr = meta.time || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Security Alert: New Login to FarmFreshFarmer</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Security Notice: A new sign-in was detected for your FarmFreshFarmer account on ${timeStr}. If this wasn't you, secure your account now.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 28px 24px; color: #ffffff; border-bottom: 3px solid #22c55e;">
                  <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff;">🛡️ FarmFreshFarmer Security</h1>
                  <p style="margin: 4px 0 0; font-size: 11px; color: #94a3b8; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Account Sign-In Notification</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 30px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800;">Hello ${name},</h2>
                  <p style="margin: 0 0 18px; font-size: 14px; color: #475569; line-height: 1.6;">
                    We noticed a successful sign-in to your FarmFreshFarmer account (<strong>${email}</strong>).
                  </p>

                  <!-- Login Metadata Card -->
                  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 22px; font-size: 13px; color: #334155;">
                    <tr>
                      <td style="padding: 4px 0; font-weight: 700; width: 110px; color: #64748b;">⏰ Time:</td>
                      <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${timeStr}</td>
                    </tr>
                    ${meta.platform ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 700; color: #64748b;">📱 Platform:</td>
                      <td style="padding: 4px 0; font-weight: 600; color: #0f172a; text-transform: uppercase;">${meta.platform}</td>
                    </tr>` : ""}
                    ${meta.ip ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 700; color: #64748b;">🌐 IP Address:</td>
                      <td style="padding: 4px 0; font-family: monospace; font-weight: 700; color: #0f172a;">${meta.ip}</td>
                    </tr>` : ""}
                    ${meta.userAgent ? `
                    <tr>
                      <td style="padding: 4px 0; font-weight: 700; color: #64748b; vertical-align: top;">💻 Device:</td>
                      <td style="padding: 4px 0; font-size: 12px; color: #475569; line-height: 1.4;">${meta.userAgent}</td>
                    </tr>` : ""}
                  </table>

                  <!-- Critical Security Notice -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 18px 20px; text-align: left; margin-bottom: 24px;">
                    <div style="font-size: 14px; font-weight: 800; color: #b91c1c; margin-bottom: 6px;">
                      ⚠️ Was this NOT you?
                    </div>
                    <p style="margin: 0 0 14px; font-size: 12px; color: #7f1d1d; line-height: 1.5;">
                      If you did not sign in recently, someone else may have gained access to your account. Take immediate action:
                    </p>
                    
                    <!-- Direct CTA to update password -->
                    <div style="text-align: center; margin: 12px 0 16px;">
                      <a href="https://farmfreshfarmer.com/account" style="background-color: #dc2626; color: #ffffff; font-size: 13px; font-weight: 800; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">
                        🔒 Update Password in Your Profile
                      </a>
                    </div>

                    <div style="border-top: 1px solid #fecaca; padding-top: 10px; font-size: 11px; color: #991b1b;">
                      <p style="margin: 0 0 4px; font-weight: 700;">Please also report this suspicious activity to us:</p>
                      <div>• 📧 <strong>Email:</strong> <a href="mailto:admin@farmfreshfarmer.com" style="color: #b91c1c; text-decoration: underline;">admin@farmfreshfarmer.com</a></div>
                      <div>• 📞 <strong>Phone &amp; WhatsApp:</strong> <a href="tel:+917989793669" style="color: #b91c1c; text-decoration: underline;">+91 79897 93669</a> / <a href="tel:+918555021322" style="color: #b91c1c; text-decoration: underline;">+91 85550 21322</a></div>
                    </div>
                  </div>

                  <p style="margin: 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                    If this was you, you can safely ignore this automated security notification.
                  </p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent automatically by FarmFreshFarmer Automated Security Guardian · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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

/** Helper: Generate Password Change OTP Email */
export function buildPasswordChangeOtpEmailHtml(name: string, otpCode: string): string {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your Password Change OTP</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Your 6-digit OTP code to update your FarmFreshFarmer password is ${otpCode}. Valid for 10 minutes.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 30px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Password Verification Code</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800;">Hello ${name},</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6;">
                    You requested to change your password without entering your old password. Use this 6-digit OTP code in your Profile to verify your identity:
                  </p>

                  <!-- OTP Code Box (Red Security Code) -->
                  <div style="text-align: center; margin: 24px 0;">
                    <div style="display: inline-block; background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 14px; padding: 14px 32px; font-family: 'Courier New', monospace; font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #dc2626; box-shadow: 0 4px 12px rgba(220, 38, 38, 0.1);">
                      ${otpCode}
                    </div>
                  </div>

                  <p style="margin: 16px 0 0; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center;">
                    ⏱️ Valid for <strong>10 minutes</strong>. Never share this code with anyone.
                  </p>

                  <!-- Security Warning -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 14px 16px; margin-top: 24px; text-align: left;">
                    <p style="margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #b91c1c;">
                      🛡️ Didn't request this verification code?
                    </p>
                    <p style="margin: 0; font-size: 11px; color: #7f1d1d; line-height: 1.5;">
                      If you did not request this OTP, please contact our support team immediately at <a href="mailto:admin@farmfreshfarmer.com" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">admin@farmfreshfarmer.com</a> or call <a href="tel:+917989793669" style="color: #b91c1c; text-decoration: underline; font-weight: 700;">+91 79897 93669</a>.
                    </p>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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

/** Helper: Generate Password Successfully Changed Email */
export function buildPasswordChangedSuccessEmailHtml(name: string, time?: string): string {
  const timeStr = time || new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) + " IST";
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Your FarmFreshFarmer Password Has Been Changed</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
      <span style="display:none;font-size:0;line-height:0;max-height:0;max-width:0;opacity:0;overflow:hidden;">
        Security Notice: Your FarmFreshFarmer password was successfully updated on ${timeStr}.
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
        <tr>
          <td align="center" style="padding: 24px 12px;">
            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 20px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
              
              <!-- Header -->
              <tr>
                <td align="center" style="background: linear-gradient(135deg, #0d3820 0%, #15803d 100%); padding: 30px 24px; color: #ffffff;">
                  <h1 style="margin: 0; font-size: 24px; font-weight: 800; color: #ffffff;">🌿 FarmFreshFarmer</h1>
                  <p style="margin: 6px 0 0; font-size: 12px; color: #bbf7d0; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 700;">Password Updated Successfully</p>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding: 32px 28px;">
                  <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 26px; color: #16a34a;">
                      ✓
                    </div>
                  </div>
                  <h2 style="margin: 0 0 12px; font-size: 18px; color: #0f172a; font-weight: 800; text-align: center;">Password Updated</h2>
                  <p style="margin: 0 0 20px; font-size: 14px; color: #475569; line-height: 1.6; text-align: center;">
                    Hello <strong>${name}</strong>,<br>
                    Your FarmFreshFarmer account password was successfully updated on <strong>${timeStr}</strong>.
                  </p>

                  <!-- Warning if unauthorized -->
                  <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 14px; padding: 16px; margin-top: 24px;">
                    <div style="font-size: 13px; font-weight: 700; color: #b91c1c; margin-bottom: 4px;">
                      ⚠️ Didn't change your password?
                    </div>
                    <p style="margin: 0 0 8px; font-size: 12px; color: #7f1d1d; line-height: 1.5;">
                      If you did not perform this change, someone else may have gained unauthorized access to your account. Please contact us immediately:
                    </p>
                    <div style="font-size: 11px; color: #991b1b;">
                      <div>• 📧 <strong>Email:</strong> <a href="mailto:admin@farmfreshfarmer.com" style="color: #b91c1c; text-decoration: underline;">admin@farmfreshfarmer.com</a></div>
                      <div>• 📞 <strong>Phone &amp; WhatsApp:</strong> <a href="tel:+917989793669" style="color: #b91c1c; text-decoration: underline;">+91 79897 93669</a> / <a href="tel:+918555021322" style="color: #b91c1c; text-decoration: underline;">+91 85550 21322</a></div>
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #f8fafc; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
                  <p style="margin: 0 0 4px;">Sent securely by FarmFreshFarmer Security · <a href="https://farmfreshfarmer.com" style="color: #16a34a; text-decoration: none;">farmfreshfarmer.com</a></p>
                  <p style="margin: 0;">© ${new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</p>
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

