import { AccountType } from "@prisma/client";
import { requirePortal } from "@/lib/demo-session";
export default async function CustomerProtectedLayout({ children }: { children: React.ReactNode }) {
  await requirePortal(AccountType.CUSTOMER);
  return children;
}
