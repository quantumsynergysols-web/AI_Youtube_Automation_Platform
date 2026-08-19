import nodemailer, { type Transporter } from 'nodemailer'
import { env } from '../config/env'
import { logger } from './logger'

let transport: Transporter | null = null

if (env.SMTP_URL) {
  transport = nodemailer.createTransport(env.SMTP_URL)
} else {
  logger.warn('SMTP_URL is not set — emails will be written to the log instead of sent')
}

export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!transport) {
    logger.info({ to, subject, text }, 'outbound email (console transport)')
    return
  }
  await transport.sendMail({ from: env.MAIL_FROM, to, subject, text })
}

export function verificationEmail(token: string): { subject: string; text: string } {
  const url = `${env.WEB_PUBLIC_URL}/verify-email?token=${encodeURIComponent(token)}`
  return {
    subject: 'Confirm your email address',
    text: `Confirm your email address to activate your account:\n\n${url}\n\nThis link expires in 24 hours.`,
  }
}

export function resetEmail(token: string): { subject: string; text: string } {
  const url = `${env.WEB_PUBLIC_URL}/reset-password?token=${encodeURIComponent(token)}`
  return {
    subject: 'Reset your password',
    text: `Reset your password using this link:\n\n${url}\n\nThis link expires in 60 minutes. If you did not request it, ignore this email.`,
  }
}
