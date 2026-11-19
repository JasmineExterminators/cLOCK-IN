// Sends email through a Gmail account using an app password (set in Vercel as GMAIL_USER and GMAIL_APP_PASSWORD).
import nodemailer from 'nodemailer';

let transport = null;

export const mailerReady = () => !!(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

export async function sendMail({ to, subject, text, html }) {
  if (!mailerReady()) throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD are not set.');
  transport ||= nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.GMAIL_USER, pass: process.env.GMAIL_APP_PASSWORD.replace(/\s+/g, '') },
  });
  return transport.sendMail({ from: `cLOCK IN Payroll <${process.env.GMAIL_USER}>`, to, subject, text, html });
}
