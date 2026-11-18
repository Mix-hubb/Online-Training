// Mail sender: Resend when RESEND_API_KEY is set, otherwise logs to the console (dev).
import { Resend } from 'resend';
import { config } from './config.js';

const resend = config.RESEND_API_KEY ? new Resend(config.RESEND_API_KEY) : null;

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Last mails, kept in memory for tests and local debugging. */
export const sentMails: MailInput[] = [];

export async function sendMail(input: MailInput): Promise<void> {
  sentMails.push(input);
  if (sentMails.length > 50) sentMails.shift();
  if (!resend) {
    if (!config.isTest) console.log(`[mail] to=${input.to} subject="${input.subject}"\n${input.text}\n`);
    return;
  }
  await resend.emails.send({
    from: config.MAIL_FROM,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export function verifyEmailMail(to: string, link: string): MailInput {
  return {
    to,
    subject: 'Verify your email for Online Training',
    text: `Welcome to Online Training.\n\nOpen this link to verify your email:\n${link}\n\nThe link works for 24 hours.`,
  };
}

export function resetPasswordMail(to: string, link: string): MailInput {
  return {
    to,
    subject: 'Reset your Online Training password',
    text: `We got a request to reset your password.\n\nOpen this link to choose a new one:\n${link}\n\nThe link works for 1 hour. If you did not ask for this, ignore this email.`,
  };
}
