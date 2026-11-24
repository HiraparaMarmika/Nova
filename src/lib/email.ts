import "server-only";
import { Prisma } from "@prisma/client";

type EmailContent = {
  eventKey: string;
  to: string;
  recipientAccountId?: string;
  subject: string;
  title: string;
  greeting?: string;
  message: string;
  details?: string[];
  action?: { label: string; url: string };
};

type QueuedEmail = EmailContent & { kind: "transactional-email" };

/**
 * Uses NOVA's durable Job table as an email outbox. The event key makes an
 * automatic event idempotent; the worker records attempts and safe failures.
 */
export async function queueEmail(tx: Prisma.TransactionClient, email: EmailContent) {
  const payload: QueuedEmail = { kind: "transactional-email", ...email };
  try {
    await tx.job.create({
      data: {
        kind: "SEND_EMAIL",
        dedupeKey: "email:" + email.eventKey,
        payload: payload as unknown as Prisma.InputJsonValue,
      },
    });
    return { queued: true as const };
  } catch (error) {
    if (isUniqueConstraint(error)) return { queued: false as const, reason: "duplicate" as const };
    throw error;
  }
}

export async function queueAccountEmail(tx: Prisma.TransactionClient, input: Omit<EmailContent, "to"> & { accountId: string }) {
  const account = await tx.account.findUnique({ where: { id: input.accountId }, select: { email: true } });
  if (!account?.email) return { queued: false as const, reason: "missing_recipient" as const };
  const { accountId, ...email } = input;
  return queueEmail(tx, { ...email, to: account.email, recipientAccountId: accountId });
}

export async function queueAdminEmails(tx: Prisma.TransactionClient, input: Omit<EmailContent, "to" | "eventKey" | "recipientAccountId"> & { eventKey: string }) {
  const admins = await tx.account.findMany({ where: { type: "ADMIN", state: "ACTIVE" }, select: { id: true, email: true } });
  return Promise.all(admins.map(admin => queueEmail(tx, {
    ...input,
    eventKey: input.eventKey + ":admin:" + admin.id,
    to: admin.email,
    recipientAccountId: admin.id,
  })));
}

/** Called only by the server worker after a queued job has been claimed. */
export async function deliverQueuedEmail(payload: unknown) {
  if (!isQueuedEmail(payload)) throw new Error("invalid_email_payload");
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) throw new Error("email_not_configured");
  const rendered = renderEmail(payload);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [payload.to], subject: payload.subject, html: rendered.html, text: rendered.text }),
  });
  if (!response.ok) throw new Error("email_delivery_failed:" + response.status);
  return response.json().catch(() => null);
}

function renderEmail(email: QueuedEmail) {
  const greeting = email.greeting ? "Hello " + escapeHtml(email.greeting) + "," : "Hello,";
  const action = email.action ? [
    '<p style="margin:28px 0"><a href="', escapeHtml(email.action.url), '" style="display:inline-block;padding:13px 20px;border-radius:8px;background:#118675;color:#ffffff;text-decoration:none;font-weight:700">', escapeHtml(email.action.label), '</a></p>',
    '<p style="word-break:break-all;color:#667085;font-size:12px">If the button does not work, use this link: ', escapeHtml(email.action.url), "</p>",
  ].join("") : "";
  const details = email.details?.length ? '<ul style="margin:20px 0;padding:0;list-style:none">' + email.details.map(detail => '<li style="padding:8px 0;border-bottom:1px solid #e7eeed">' + escapeHtml(detail) + "</li>").join("") + "</ul>" : "";
  const html = [
    '<!doctype html><html><body style="margin:0;background:#f3f7f6;font-family:Arial,sans-serif;color:#18334a"><main style="max-width:600px;margin:32px auto;background:#ffffff;border:1px solid #dce8e5;border-radius:14px;overflow:hidden">',
    '<header style="padding:24px 30px;background:#102843;color:#ffffff"><strong style="font-size:24px;letter-spacing:2px">NOVA</strong><div style="margin-top:7px;color:#bdeee1;font-size:13px">Thoughtful cleaning support</div></header>',
    '<section style="padding:30px"><h1 style="margin:0 0 18px;font-size:24px;color:#102843">', escapeHtml(email.title), "</h1><p>", greeting, '</p><p style="line-height:1.6">', escapeHtml(email.message), "</p>", details, action,
    '<p style="margin-top:28px;color:#667085;font-size:12px;line-height:1.5">This is a transactional NOVA email about your account or service. If you need help, please contact NOVA support.</p></section></main></body></html>',
  ].join("");
  const text = [email.title, "", email.greeting ? "Hello " + email.greeting + "," : "Hello,", "", email.message, ...(email.details ?? []), email.action ? "\\n" + email.action.label + ": " + email.action.url : "", "\\nNOVA support"].join("\\n");
  return { html, text };
}

function isQueuedEmail(value: unknown): value is QueuedEmail {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<QueuedEmail>;
  return item.kind === "transactional-email" && typeof item.eventKey === "string" && typeof item.to === "string" && typeof item.subject === "string" && typeof item.title === "string" && typeof item.message === "string";
}

function isUniqueConstraint(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[character]!);
}
