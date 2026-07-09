import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
}

let transporter: Transporter | null = null;

function getEmailConfig(): EmailConfig | null {
  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;

  if (!host || !port || !user || !pass || !from) {
    console.warn('SMTP not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in env');
    return null;
  }

  return {
    host,
    port: parseInt(port, 10),
    secure: port === '465', // true for 465, false for other ports
    auth: { user, pass },
    from,
  };
}

function getTransporter(): Transporter | null {
  if (!transporter) {
    const config = getEmailConfig();
    if (!config) return null;

    transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.auth,
    });
  }
  return transporter;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<{ success: boolean; error?: string }> {
  const transport = getTransporter();
  if (!transport) {
    return { success: false, error: 'SMTP not configured' };
  }

  const config = getEmailConfig();
  if (!config) {
    return { success: false, error: 'SMTP not configured' };
  }

  try {
    await transport.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });
    return { success: true };
  } catch (error: any) {
    console.error('Email send error:', error);
    return { success: false, error: error.message || 'Failed to send email' };
  }
}

export async function sendInvoiceEmail(
  to: string,
  invoiceNumber: string,
  invoiceHtml: string,
  companyName: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `Invoice ${invoiceNumber} from ${companyName}`;
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">Invoice ${invoiceNumber}</h2>
      <p style="margin: 8px 0 0 0; color: #666;">From ${companyName}</p>
    </div>
    
    <p>Please find your invoice attached below.</p>
    
    <div style="border: 1px solid #ddd; border-radius: 8px; overflow: hidden; margin: 20px 0;">
      ${invoiceHtml}
    </div>
    
    <p>If you have any questions about this invoice, please reply to this email.</p>
    
    <div class="footer">
      <p>This is an automated email from ${companyName}. Please do not reply directly to this message.</p>
    </div>
  </div>
</body>
</html>
  `;

  return sendEmail({ to, subject, html });
}

export async function sendInviteEmail(
  to: string,
  inviterName: string,
  companyName: string,
  signupUrl: string,
  inviteToken?: string
): Promise<{ success: boolean; error?: string }> {
  const subject = `You've been invited to join ${companyName}`;

  // If an invite token was provided, append it to the signup URL so the
  // recipient lands on a page that can call /auth/accept-invite. Backward
  // compatible: existing callers that omit the token keep the plain URL.
  if (inviteToken) {
    const separator = signupUrl.includes('?') ? '&' : '?';
    signupUrl = `${signupUrl}${separator}token=${encodeURIComponent(inviteToken)}`;
  }

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; line-height: 1.6; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; text-align: center; }
    .button { display: inline-block; padding: 12px 24px; background: #1a1a1a; color: white; text-decoration: none; border-radius: 6px; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">You're invited!</h2>
      <p style="margin: 8px 0 0 0; color: #666;">Join ${companyName}</p>
    </div>
    
    <p>Hi there,</p>
    
    <p>${inviterName} has invited you to join the team at <strong>${companyName}</strong>.</p>
    
    <p>Click the button below to create your account and get started:</p>
    
    <div style="text-align: center;">
      <a href="${signupUrl}" class="button">Create Account</a>
    </div>
    
    <p>Or copy and paste this link into your browser:</p>
    <p style="word-break: break-all; color: #666; font-size: 14px;">${signupUrl}</p>
    
    <div class="footer">
      <p>This invitation was sent by ${inviterName} from ${companyName}.</p>
      <p>If you were not expecting this invitation, you can safely ignore this email.</p>
    </div>
  </div>
</body>
</html>
  `;

  const text = `
You've been invited to join ${companyName}

${inviterName} has invited you to join the team at ${companyName}.

Create your account here: ${signupUrl}

If you were not expecting this invitation, you can safely ignore this email.
  `;

  return sendEmail({ to, subject, html, text });
}
