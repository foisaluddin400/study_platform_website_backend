import nodemailer, { Transporter, SentMessageInfo } from "nodemailer";
import { env } from "../config/env";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content?: string | Buffer;
    path?: string;
    contentType?: string;
  }>;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  response?: string;
  error?: string;
}

class EmailService {
  private transporter: Transporter | null = null;
  private isConfigured: boolean = false;

  constructor() {
    this.initTransporter();
  }

  /**
   * Initializes the Nodemailer transporter using environment variables.
   */
  private initTransporter(): void {
    const user = (env.emailUser || process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
    const pass = (env.emailPassword || process.env.SMTP_PASS || process.env.EMAIL_PASSWORD || "").trim();
    const host = (env.smtpHost || process.env.SMTP_HOST || "").trim();
    const service = (env.smtpService || process.env.SMTP_SERVICE || "").trim();
    const port = env.smtpPort || (process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT, 10) : 587);
    const secure = env.smtpSecure !== undefined ? env.smtpSecure : port === 465;

    const hasCredentials = Boolean(user && pass);
    const hasHost = Boolean(host || service);

    if (!hasCredentials || !hasHost) {
      console.warn(
        "⚠️  [EmailService] SMTP credentials or host not fully configured in environment variables. Outbound emails will be simulated in development."
      );
      this.isConfigured = false;
      return;
    }

    try {
      const config: any = {
        host: host || undefined,
        port,
        secure, // true for 465, false for 587 / STARTTLS
        auth: {
          user,
          pass,
        },
        tls: {
          rejectUnauthorized: env.nodeEnv === "production",
        },
      };

      if (service) {
        config.service = service;
      }

      this.transporter = nodemailer.createTransport(config);
      this.isConfigured = true;
      console.log(
        `📧 [EmailService] Configured Nodemailer with host="${host || service}", port=${port}, secure=${secure}, user="${user}"`
      );
    } catch (err: any) {
      console.error("❌ [EmailService] Failed to initialize Nodemailer transporter:", err.message);
      this.isConfigured = false;
      this.transporter = null;
    }
  }

  /**
   * Verifies the SMTP connection and credentials handshake.
   */
  public async verifyConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.transporter || !this.isConfigured) {
      this.initTransporter();
    }

    if (!this.transporter) {
      return {
        success: false,
        message: "Email transporter is not configured. Please set SMTP_HOST, SMTP_USER, and SMTP_PASS.",
      };
    }

    try {
      await this.transporter.verify();
      return {
        success: true,
        message: `SMTP connection established successfully with ${env.smtpHost || env.smtpService}:${env.smtpPort}`,
      };
    } catch (error: any) {
      console.error("❌ [EmailService] SMTP Verification failed:", error.message);
      return {
        success: false,
        message: `SMTP Connection error: ${error.message}`,
      };
    }
  }

  /**
   * Formats the standard sender address (e.g. "AbroadPath OS <no-reply@abroadpath.com>")
   */
  private getFromHeader(): string {
    const fromName = env.emailFromName || "AbroadPath OS";
    const fromEmail = env.emailFrom || "no-reply@abroadpath.com";
    return `"${fromName}" <${fromEmail}>`;
  }

  /**
   * Core sendEmail method with full error handling and delivery logging.
   */
  public async sendEmail(options: SendEmailOptions): Promise<EmailSendResult> {
    const recipients = Array.isArray(options.to) ? options.to.join(", ") : options.to;
    const from = this.getFromHeader();

    // If transporter is not configured, re-attempt initialization
    if (!this.transporter) {
      this.initTransporter();
    }

    // In local development without credentials, log the email gracefully without crashing
    if (!this.transporter || !this.isConfigured) {
      console.log("------------------------------------------------------------");
      console.log(`📨 [EmailService: SIMULATION] Email dispatch simulated:`);
      console.log(`   To: ${recipients}`);
      console.log(`   From: ${from}`);
      console.log(`   Subject: ${options.subject}`);
      console.log(`   (Configure SMTP_USER and SMTP_PASS in .env to deliver to real addresses)`);
      console.log("------------------------------------------------------------");
      return {
        success: true,
        messageId: `simulated-${Date.now()}`,
        response: "Email delivery simulated (SMTP credentials missing in development).",
      };
    }

    try {
      const startTime = Date.now();
      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
        replyTo: options.replyTo,
        attachments: options.attachments,
      };

      const info: SentMessageInfo = await this.transporter.sendMail(mailOptions);
      const elapsed = Date.now() - startTime;

      console.log(
        `✅ [EmailService] Email sent successfully in ${elapsed}ms | MessageId: ${info.messageId} | Recipient(s): ${recipients}`
      );

      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error: any) {
      console.error(`❌ [EmailService] Email delivery failure to ${recipients}:`, {
        code: error.code,
        command: error.command,
        message: error.message,
      });

      return {
        success: false,
        error: error.message || "Failed to send email",
      };
    }
  }

  /**
   * Helper: Strips HTML tags for fallback plain text body
   */
  private stripHtml(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  /**
   * Base HTML Layout for AbroadPath OS branded transactional emails.
   */
  private wrapEmailTemplate(title: string, contentHtml: string): string {
    const year = new Date().getFullYear();
    const appUrl = env.clientUrl || "https://abroadpath.com";

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background-color: #f8fafc;
      color: #1e293b;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #f8fafc;
      padding: 40px 0;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-spacing: 0;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
      border: 1px solid #e2e8f0;
    }
    .header {
      background: linear-gradient(135deg, #0d9488 0%, #0f766e 100%);
      padding: 32px 40px;
      text-align: center;
    }
    .logo-text {
      color: #ffffff;
      font-size: 22px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin: 0;
      text-decoration: none;
    }
    .logo-sub {
      color: #ccfbf1;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 4px;
    }
    .content {
      padding: 40px;
      font-size: 15px;
      line-height: 1.6;
      color: #334155;
    }
    .button-container {
      margin: 30px 0;
      text-align: center;
    }
    .button {
      background-color: #0d9488;
      color: #ffffff !important;
      padding: 14px 32px;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 600;
      font-size: 15px;
      display: inline-block;
      box-shadow: 0 2px 4px rgba(13, 148, 136, 0.2);
    }
    .info-card {
      background-color: #f1f5f9;
      border-radius: 10px;
      padding: 18px 24px;
      margin: 24px 0;
      border-left: 4px solid #0d9488;
    }
    .info-item {
      margin: 6px 0;
      font-size: 14px;
    }
    .footer {
      padding: 24px 40px;
      background-color: #f8fafc;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    .footer a {
      color: #0d9488;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <table class="wrapper" role="presentation">
    <tr>
      <td align="center">
        <table class="main" role="presentation">
          <tr>
            <td class="header">
              <div class="logo-text">AbroadPath OS</div>
              <div class="logo-sub">Global Study Abroad Operations</div>
            </td>
          </tr>
          <tr>
            <td class="content">
              ${contentHtml}
            </td>
          </tr>
          <tr>
            <td class="footer">
              <p style="margin: 0 0 8px 0;">This email was sent automatically by AbroadPath OS.</p>
              <p style="margin: 0 0 8px 0;">&copy; ${year} AbroadPath OS. All rights reserved.</p>
              <p style="margin: 0;"><a href="${appUrl}">Visit Platform</a> &bull; <a href="mailto:support@abroadpath.com">Contact Support</a></p>
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

  /**
   * Template: Welcome Email for newly registered agency directors or students
   */
  public async sendWelcomeEmail(options: {
    to: string;
    name: string;
    role?: string;
    loginUrl?: string;
  }): Promise<EmailSendResult> {
    const loginUrl = options.loginUrl || `${env.clientUrl}/login`;
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to AbroadPath OS, ${options.name}! 👋</h2>
      <p>Thank you for joining our study abroad agency management platform. Your account is now active and ready to use.</p>
      
      <div class="info-card">
        <div class="info-item"><strong>Account:</strong> ${options.to}</div>
        ${options.role ? `<div class="info-item"><strong>Role:</strong> ${options.role}</div>` : ""}
        <div class="info-item"><strong>Status:</strong> Free Access — Lifetime</div>
      </div>

      <p>You can manage students, university applications, commission tracking, visa cases, and counselor workflows in one unified portal.</p>
      
      <div class="button-container">
        <a href="${loginUrl}" class="button">Access Your Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748b;">If you have any questions or need help onboarding your team, simply reply to this email.</p>
    `;

    return this.sendEmail({
      to: options.to,
      subject: `Welcome to AbroadPath OS, ${options.name}!`,
      html: this.wrapEmailTemplate("Welcome to AbroadPath OS", content),
    });
  }

  /**
   * Template: Password Reset Email with secure token link
   */
  public async sendPasswordResetEmail(options: {
    to: string;
    name: string;
    resetUrl: string;
    token?: string;
    expiresInMinutes?: number;
  }): Promise<EmailSendResult> {
    const expires = options.expiresInMinutes || 60;
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Password Reset Request</h2>
      <p>Hello ${options.name},</p>
      <p>We received a request to reset the password for your AbroadPath OS account associated with <strong>${options.to}</strong>.</p>
      
      <p>Click the button below to set a new password. This link is valid for <strong>${expires} minutes</strong>:</p>
      
      <div class="button-container">
        <a href="${options.resetUrl}" class="button">Reset Password</a>
      </div>

      <div class="info-card">
        <p style="margin: 0; font-size: 13px; color: #475569;">
          <strong>Security Notice:</strong> If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.
        </p>
      </div>

      <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
        If the button above does not work, copy and paste this link into your browser:<br/>
        <a href="${options.resetUrl}" style="color: #0d9488;">${options.resetUrl}</a>
      </p>
    `;

    return this.sendEmail({
      to: options.to,
      subject: "Password Reset Request - AbroadPath OS",
      html: this.wrapEmailTemplate("Reset Your Password", content),
    });
  }

  /**
   * Template: Email Verification link
   */
  public async sendVerificationEmail(options: {
    to: string;
    name: string;
    verificationUrl: string;
    token?: string;
  }): Promise<EmailSendResult> {
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Verify Your Email Address</h2>
      <p>Hello ${options.name},</p>
      <p>Please verify your email address to confirm your account and ensure secure access to AbroadPath OS.</p>
      
      <div class="button-container">
        <a href="${options.verificationUrl}" class="button">Verify Email Address</a>
      </div>

      <p style="font-size: 12px; color: #94a3b8; word-break: break-all;">
        Or paste this link in your browser:<br/>
        <a href="${options.verificationUrl}" style="color: #0d9488;">${options.verificationUrl}</a>
      </p>
    `;

    return this.sendEmail({
      to: options.to,
      subject: "Verify your email address - AbroadPath OS",
      html: this.wrapEmailTemplate("Email Verification", content),
    });
  }

  /**
   * Template: Team Invitation Email
   */
  public async sendTeamInviteEmail(options: {
    to: string;
    name: string;
    inviterName: string;
    agencyName: string;
    role: string;
    password?: string;
    tempPassword?: string;
    loginUrl?: string;
  }): Promise<EmailSendResult> {
    const loginUrl = options.loginUrl || `${env.clientUrl}/login`;
    const pwd = options.password || options.tempPassword;
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">You've been invited to join ${options.agencyName}!</h2>
      <p>Hello ${options.name},</p>
      <p><strong>${options.inviterName}</strong> has invited you to join their agency team on AbroadPath OS as a <strong>${options.role}</strong>.</p>
      
      <div class="info-card">
        <div class="info-item"><strong>Agency:</strong> ${options.agencyName}</div>
        <div class="info-item"><strong>Email:</strong> ${options.to}</div>
        <div class="info-item"><strong>Role:</strong> ${options.role}</div>
        ${pwd ? `<div class="info-item"><strong>Login Password:</strong> <code style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-weight:700; color:#0f172a;">${pwd}</code></div>` : ""}
      </div>

      <p>Click below to sign in and begin managing student applications and documents:</p>

      <div class="button-container">
        <a href="${loginUrl}" class="button">Sign In to Agency Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748b;">You can log in anytime using your registered email and password.</p>
    `;

    return this.sendEmail({
      to: options.to,
      subject: `Invitation to join ${options.agencyName} on AbroadPath OS`,
      html: this.wrapEmailTemplate("Team Invitation", content),
    });
  }

  /**
   * Template: System / Activity Notification Email
   */
  public async sendNotificationEmail(options: {
    to: string;
    name: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionText?: string;
  }): Promise<EmailSendResult> {
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">${options.title}</h2>
      <p>Hello ${options.name},</p>
      <div class="info-card">
        <p style="margin: 0; font-size: 14px; color: #334155;">${options.message}</p>
      </div>

      ${
        options.actionUrl
          ? `
      <div class="button-container">
        <a href="${options.actionUrl}" class="button">${options.actionText || "View Details"}</a>
      </div>`
          : ""
      }
    `;

    return this.sendEmail({
      to: options.to,
      subject: `${options.title} - AbroadPath OS`,
      html: this.wrapEmailTemplate(options.title, content),
    });
  }

  /**
   * Template: Student Welcome & Onboarding Email when a Student profile is created
   */
  public async sendStudentWelcomeEmail(options: {
    to: string;
    name: string;
    agencyName?: string;
    counselorName?: string;
    counselorEmail?: string;
    preferredCourse?: string;
    preferredCountries?: string[];
    targetDegree?: string;
    intake?: string;
    loginPassword?: string;
    portalUrl?: string;
  }): Promise<EmailSendResult> {
    const portalUrl = options.portalUrl || `${env.clientUrl}/login`;
    const agencyName = options.agencyName || "AbroadPath Partner Consultancy";
    const counselorInfo = options.counselorName
      ? `<div class="info-item"><strong>Assigned Counselor:</strong> ${options.counselorName}${options.counselorEmail ? ` (${options.counselorEmail})` : ""}</div>`
      : "";
    const studyPlan = options.preferredCourse
      ? `<div class="info-item"><strong>Target Program:</strong> ${options.preferredCourse} ${options.targetDegree ? `(${options.targetDegree})` : ""}</div>`
      : "";
    const countries =
      options.preferredCountries && options.preferredCountries.length > 0
        ? `<div class="info-item"><strong>Preferred Destination(s):</strong> ${options.preferredCountries.join(", ")}</div>`
        : "";
    const intake = options.intake
      ? `<div class="info-item"><strong>Target Intake:</strong> ${options.intake}</div>`
      : "";
    const passwordInfo = options.loginPassword
      ? `<div class="info-item"><strong>Login Password:</strong> <code style="background:#e2e8f0; padding:2px 8px; border-radius:4px; font-weight:700; font-size:13px; color:#0f172a;">${options.loginPassword}</code></div>`
      : "";

    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">Welcome to Your Study Abroad Journey, ${options.name}! 🎓</h2>
      <p>Your official student profile and applicant portal have been created with <strong>${agencyName}</strong> on AbroadPath OS.</p>
      
      <div class="info-card">
        <div class="info-item"><strong>Student Name:</strong> ${options.name}</div>
        <div class="info-item"><strong>Login Email:</strong> ${options.to}</div>
        ${passwordInfo}
        ${counselorInfo}
        ${studyPlan}
        ${countries}
        ${intake}
      </div>

      <p>You can sign in to your student portal anytime to upload academic transcripts, track university applications, view offer letters, and message your counselor.</p>

      <div class="button-container">
        <a href="${portalUrl}" class="button">Sign In to Student Portal</a>
      </div>

      <p style="font-size: 13px; color: #64748b;">If you have any questions, you can reply directly to this email or reach out to your assigned counselor.</p>
    `;

    return this.sendEmail({
      to: options.to,
      subject: `Welcome to ${agencyName} - Student Portal Credentials`,
      html: this.wrapEmailTemplate("Student Profile Created", content),
    });
  }

  /**
   * Template: Test Email to verify SMTP configuration with a real inbox
   */
  public async sendTestEmail(options: {
    to: string;
    customMessage?: string;
  }): Promise<EmailSendResult> {
    const timestamp = new Date().toUTCString();
    const content = `
      <h2 style="color: #0f172a; margin-top: 0; font-size: 20px;">🎉 SMTP Test Email Successful!</h2>
      <p>This email confirms that your AbroadPath OS production email delivery pipeline is configured correctly and functioning properly.</p>
      
      <div class="info-card">
        <div class="info-item"><strong>Recipient:</strong> ${options.to}</div>
        <div class="info-item"><strong>Sent At:</strong> ${timestamp}</div>
        <div class="info-item"><strong>SMTP Host:</strong> ${env.smtpHost || env.smtpService}</div>
        <div class="info-item"><strong>SMTP Port:</strong> ${env.smtpPort}</div>
        <div class="info-item"><strong>TLS / Secure:</strong> ${env.smtpSecure ? "SSL/TLS (Port 465)" : "STARTTLS (Port 587/25)"}</div>
        <div class="info-item"><strong>From Address:</strong> ${this.getFromHeader()}</div>
      </div>

      ${options.customMessage ? `<p><strong>Custom Note:</strong> ${options.customMessage}</p>` : ""}

      <div class="button-container">
        <a href="${env.clientUrl}" class="button">Visit Dashboard</a>
      </div>
    `;

    return this.sendEmail({
      to: options.to,
      subject: "🧪 Test Email from AbroadPath OS",
      html: this.wrapEmailTemplate("SMTP Test Email", content),
    });
  }
}

// Export singleton instance
export const emailService = new EmailService();
export default emailService;
