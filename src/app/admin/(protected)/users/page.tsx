import { AccountType, InvitationStatus } from "@prisma/client";
import { cookies } from "next/headers";
import { AdminInviteForm } from "@/components/admin-invite-form";
import { AdminUsersTable } from "@/components/admin-users-table";
import { PortalFrame } from "@/components/portal";
import { getAdminCopy } from "@/lib/admin-copy";
import { prisma } from "@/lib/db";
import { requirePortal } from "@/lib/demo-session";

export default async function AdminUsersPage() {
  await requirePortal(AccountType.ADMIN);
  const locale = (await cookies()).get("nova-locale")?.value === "de" ? "de" : "en";
  const copy = getAdminCopy(locale);
  const accounts = await prisma.account.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      customer: { select: { name: true, phone: true } },
      cleaner: { select: { name: true } },
      invite: { select: { id: true, status: true, expiresAt: true, reason: true, lastSentAt: true } },
    },
  });
  const now = new Date();
  const rows = accounts.map((account) => ({
    id: account.id,
    email: account.email,
    type: account.type,
    state: account.state,
    createdAt: account.createdAt.toISOString(),
    name: account.customer?.name ?? account.cleaner?.name ?? account.displayName ?? "—",
    phone: account.customer?.phone ?? account.phone ?? null,
    invite: account.invite
      ? {
          ...account.invite,
          status: account.invite.status === InvitationStatus.PENDING && account.invite.expiresAt <= now ? InvitationStatus.EXPIRED : account.invite.status,
          expiresAt: account.invite.expiresAt.toISOString(),
          lastSentAt: account.invite.lastSentAt.toISOString(),
        }
      : null,
  }));

  return <PortalFrame portal="admin"><div className="portal-page-head"><div><span className="eyebrow">{copy.eyebrow.accounts}</span><h1>{copy.pages.users.title}</h1><p className="muted">{copy.pages.users.description}</p></div></div><AdminInviteForm /><section className="card table-card"><div className="table-head"><h2>{copy.labels.allAccounts}</h2><span className="status">{accounts.length} {copy.labels.users}</span></div><AdminUsersTable accounts={rows} /></section></PortalFrame>;
}
