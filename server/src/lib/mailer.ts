import nodemailer from 'nodemailer';
import { config } from '../config';

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '465', 10),
  secure: process.env.SMTP_SECURE !== 'false', // true by default (for port 465)
  auth: {
    user: process.env.SMTP_USER || 'krishrk1982@gmail.com',
    pass: process.env.SMTP_PASS || '', // App password goes here
  },
});

export async function sendVerificationEmail(email: string, token: string, baseUrl?: string) {
  const clientUrl = baseUrl || process.env.CLIENT_URL || 'http://localhost:5173';
  const verificationLink = `${clientUrl}/api/auth/verify?token=${token}`;

  const mailOptions = {
    from: `"OpenModels" <${process.env.SMTP_USER || 'krishrk1982@gmail.com'}>`,
    to: email,
    subject: 'Verify Your OpenModels Account',
    html: `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #0b0f19; color: #f3f4f6; padding: 40px 20px; max-width: 600px; margin: auto; border-radius: 16px; border: 1px solid #1f2937;">
        <div style="text-align: center; margin-bottom: 30px;">
          <div style="display: inline-block; padding: 12px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); border-radius: 12px; margin-bottom: 16px; box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);">
            <span style="font-size: 24px; font-weight: bold; color: #ffffff;">OM</span>
          </div>
          <h1 style="font-size: 24px; font-weight: bold; margin: 0; color: #ffffff; letter-spacing: -0.025em;">Verify Your Email</h1>
          <p style="color: #9ca3af; font-size: 14px; margin-top: 8px;">Welcome to OpenModels - the multi-provider AI chat platform.</p>
        </div>

        <div style="background-color: #111827; border: 1px solid #374151; padding: 24px; border-radius: 12px; margin-bottom: 24px;">
          <p style="font-size: 15px; line-height: 1.6; color: #d1d5db; margin-top: 0;">
            Hi there,
          </p>
          <p style="font-size: 15px; line-height: 1.6; color: #d1d5db;">
            Thank you for signing up for OpenModels! Before you can start chatting with all the premium AI models, please verify your email address by clicking the link below:
          </p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${verificationLink}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); color: #ffffff; font-size: 15px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 14px rgba(99, 102, 241, 0.3); transition: all 0.2s;">
              Verify Email Address
            </a>
          </div>

          <p style="font-size: 13px; color: #9ca3af; line-height: 1.5; margin-bottom: 0;">
            This link is valid for the next 24 hours. If you did not create an account on OpenModels, you can safely ignore this email.
          </p>
        </div>

        <div style="text-align: center; font-size: 12px; color: #6b7280; border-top: 1px solid #1f2937; padding-top: 20px;">
          <p style="margin: 0 0 8px 0;">OpenModels Platform</p>
          <p style="margin: 0; font-size: 11px;">
            If the button doesn't work, copy and paste this URL into your browser:<br/>
            <a href="${verificationLink}" style="color: #6366f1; text-decoration: underline; word-break: break-all;">${verificationLink}</a>
          </p>
        </div>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Verification email sent:', info.messageId);
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Mailer] [DEV ONLY] Verification link: ${verificationLink}`);
    }
    return info;
  } catch (error) {
    console.error('[Mailer] Error sending verification email:', error);
    throw error;
  }
}
