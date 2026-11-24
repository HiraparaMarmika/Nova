import { AccountType } from "@prisma/client";
import { requirePortal } from "@/lib/demo-session";
export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  await requirePortal(AccountType.ADMIN);
  return children;
}
