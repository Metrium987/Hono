import { Resend } from "resend";

export const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL ?? "noreply@hono.pf";

export const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
