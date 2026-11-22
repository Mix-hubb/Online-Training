// Mail sender: Resend when RESEND_API_KEY is set, otherwise logs to the console (dev).
// Every mail has a plain-text and an HTML version. MAIL_FROM must use a domain verified in Resend.
import { Resend } from 'resend';
import { config } from './config.js';

// Tests never reach the real provider, even when .env has a key.
const resend = config.RESEND_API_KEY && !config.isTest ? new Resend(config.RESEND_API_KEY) : null;

export interface MailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/** Last mails, kept in memory for tests and local debugging. */
export const sentMails: MailInput[] = [];

/** Test hook: make the next sends fail, to check how callers handle a provider error. */
export const mailTest = { failNext: 0 };

export class MailError extends Error {}

/** Sends one mail. Throws MailError when the provider refuses it (Resend returns errors, it does not throw). */
export async function sendMail(input: MailInput): Promise<void> {
  if (mailTest.failNext > 0) {
    mailTest.failNext--;
    throw new MailError('Simulated mail failure');
  }
  sentMails.push(input);
  if (sentMails.length > 50) sentMails.shift();
  if (!resend) {
    if (!config.isTest) console.log(`[mail] to=${input.to} subject="${input.subject}"\n${input.text}\n`);
    return;
  }
  let result: Awaited<ReturnType<typeof resend.emails.send>>;
  try {
    result = await resend.emails.send({ from: config.MAIL_FROM, to: input.to, subject: input.subject, text: input.text, html: input.html });
  } catch (e) {
    throw new MailError(`Resend request failed: ${(e as Error).message}`);
  }
  if (result.error) throw new MailError(`Resend refused the mail: ${result.error.name}: ${result.error.message}`);
}

/**
 * Sends a mail but never fails the request: the error is logged with the subject (never the link or token).
 * Used where the response must not reveal whether an account exists, and after a user row was already created.
 */
export async function sendMailSafe(input: MailInput): Promise<boolean> {
  try {
    await sendMail(input);
    return true;
  } catch (e) {
    console.error(`[mail] failed subject="${input.subject}":`, (e as Error).message);
    return false;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Simple, email-client-safe layout (tables + inline styles), white and blue like the site. */
function layout(o: { heading: string; intro: string; button: string; link: string; note: string }) {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#F4F7FB;font-family:Arial,Helvetica,sans-serif;color:#14213D">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F7FB;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#FFFFFF;border:1px solid #DCE5EF;border-radius:6px">
<tr><td style="padding:24px 28px 0;font-size:15px;font-weight:bold;color:#1F6FB8">Online Training</td></tr>
<tr><td style="padding:16px 28px 0;font-size:20px;font-weight:bold">${esc(o.heading)}</td></tr>
<tr><td style="padding:12px 28px 0;font-size:15px;line-height:1.5;color:#3A4B5F">${esc(o.intro)}</td></tr>
<tr><td style="padding:24px 28px">
<a href="${esc(o.link)}" style="display:inline-block;background:#1F6FB8;color:#FFFFFF;text-decoration:none;font-weight:bold;font-size:15px;padding:12px 22px;border-radius:4px">${esc(o.button)}</a>
</td></tr>
<tr><td style="padding:0 28px;font-size:13px;line-height:1.5;color:#5B6B7F">If the button does not work, copy this link into your browser:<br><a href="${esc(o.link)}" style="color:#1F6FB8;word-break:break-all">${esc(o.link)}</a></td></tr>
<tr><td style="padding:16px 28px 24px;font-size:13px;line-height:1.5;color:#5B6B7F">${esc(o.note)}</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function verifyEmailMail(to: string, link: string): MailInput {
  return {
    to,
    subject: 'Verify your email for Online Training',
    text: `Welcome to Online Training.\n\nOpen this link to verify your email:\n${link}\n\nThe link works for 24 hours.`,
    html: layout({
      heading: 'Verify your email',
      intro: 'Welcome to Online Training. Confirm your email address to start learning.',
      button: 'Verify email',
      link,
      note: 'The link works for 24 hours. If you did not sign up, you can ignore this email.',
    }),
  };
}

export function resetPasswordMail(to: string, link: string): MailInput {
  return {
    to,
    subject: 'Reset your Online Training password',
    text: `We got a request to reset your password.\n\nOpen this link to choose a new one:\n${link}\n\nThe link works for 1 hour. If you did not ask for this, ignore this email.`,
    html: layout({
      heading: 'Reset your password',
      intro: 'We got a request to reset the password for your Online Training account.',
      button: 'Choose a new password',
      link,
      note: 'The link works for 1 hour and only once. If you did not ask for this, ignore this email: your password stays the same.',
    }),
  };
}

export function passwordChangedMail(to: string): MailInput {
  const link = `${config.WEB_URL}/forgot-password`;
  return {
    to,
    subject: 'Your Online Training password was changed',
    text: `The password for your Online Training account was just changed.\n\nIf this was not you, reset it now:\n${link}`,
    html: layout({
      heading: 'Your password was changed',
      intro: 'The password for your Online Training account was just changed.',
      button: 'This was not me: reset it',
      link,
      note: 'If you made this change, there is nothing else to do.',
    }),
  };
}
