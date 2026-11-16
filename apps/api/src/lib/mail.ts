import nodemailer from 'nodemailer';
import { config } from '../config';

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  if (!config.smtp.host || !config.smtp.from) {
    throw new Error('SMTP_HOST and SMTP_FROM are not configured');
  }

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    ...(config.smtp.user ? { auth: { user: config.smtp.user, pass: config.smtp.password } } : {}),
  });

  await transporter.sendMail({
    from: config.smtp.from,
    to: email,
    subject: 'Reset your Helpdesk password',
    text: `Use this link to reset your password. It expires in one hour: ${resetLink}`,
    html: `<p>We received a request to reset your Helpdesk password.</p><p><a href="${resetLink}">Reset password</a></p><p>This link expires in one hour. If you did not request this, you can ignore this email.</p>`,
  });
}
