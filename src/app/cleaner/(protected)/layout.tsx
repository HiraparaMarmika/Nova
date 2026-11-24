import { AccountType } from "@prisma/client";
import { requirePortal } from "@/lib/demo-session";
export default async function CleanerProtectedLayout({ children }: { children: React.ReactNode }) {
  await requirePortal(AccountType.CLEANER);
  return children;
}
