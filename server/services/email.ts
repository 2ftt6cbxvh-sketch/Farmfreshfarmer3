/**
 * Production Email Delivery Service for FarmFreshFarmer.
 * Integrates Resend API / SMTP (Nodemailer) to dispatch real emails for:
 *   1. Email 6-Digit OTP Login & Verification
 *   2. Password Reset Links & Codes
 *   3. Order Confirmations
 */

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendRealEmail(opts: SendEmailOptions): Promise<boolean> {
  const { to, subject, html } = opts;

  // 1. Check if Resend API Key is configured
  if (process.env.RESEND_API_KEY) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "FarmFreshFarmer <no-reply@resend.dev>",
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

  // 2. Check if SMTP Transport is configured (Gmail / SendGrid / AWS SES)
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      // @ts-ignore - nodemailer loaded dynamically, types optional
      const nodemailer = await import("nodemailer");
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587", 10),
        secure: process.env.SMTP_PORT === "465",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      await transporter.sendMail({
        from: process.env.EMAIL_FROM || `"FarmFreshFarmer" <${process.env.SMTP_USER}>`,
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

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
        If you did not request this OTP, please ignore this email.
      </p>
    </div>
  `;
}

/** Helper: Generate HTML Template for Password Reset Email */
export function buildResetPasswordHtml(resetUrl: string, name = "Valued Customer"): string {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 550px; margin: 0 auto; background-color: #092615; color: #ffffff; padding: 32px; border-radius: 24px; border: 1px solid #15803d;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #86efac; font-size: 26px; margin: 0; font-family: Georgia, serif;">🌿 FarmFreshFarmer</h1>
        <p style="color: #94a3b8; font-size: 13px; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px;">Security & Account Support</p>
      </div>

      <div style="background-color: #0f172a; padding: 24px; border-radius: 16px; border: 1px solid #334155; text-align: center; margin-bottom: 24px;">
        <h2 style="color: #ffffff; font-size: 20px; margin-top: 0;">Password Reset Request</h2>
        <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 20px;">Hello ${name}, click the button below to reset your password securely:</p>

        <a href="${resetUrl}" style="background: linear-gradient(135deg, #15803d, #22c55e); color: #ffffff; text-decoration: none; font-size: 16px; font-weight: bold; padding: 14px 28px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 12px rgba(34, 197, 94, 0.4);">
          Reset Password Now
        </a>

        <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">This reset link is valid for <strong>1 hour</strong>.</p>
      </div>

      <p style="color: #64748b; font-size: 12px; text-align: center; margin: 0;">
        If you did not request a password reset, your account is safe and you can ignore this email.
      </p>
    </div>
  `;
}
