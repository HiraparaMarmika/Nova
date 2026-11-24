import "dotenv/config";
import { AccountType, PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

function argument(name: string) {
  return process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

async function main() {
  const email = argument("email")?.trim().toLowerCase();
  const role = argument("role")?.toUpperCase();
  const password = argument("password");
  if (!email || !role || !password || password.length < 12 || !Object.values(AccountType).includes(role as AccountType)) {
    throw new Error("Usage: npm run db:set-password -- --email=user@example.com --role=CUSTOMER|CLEANER|ADMIN --password=at-least-12-characters");
  }
  const account = await prisma.account.update({
    where: { email_type: { email, type: role as AccountType } },
    data: { passwordHash: await hashPassword(password) }
  });
  console.log(`Password updated for ${account.email} (${account.type}).`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
