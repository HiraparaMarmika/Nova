CREATE TABLE "AccountInvite"(
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL UNIQUE REFERENCES "Account"("id") ON DELETE CASCADE,
  "tokenHash" text NOT NULL UNIQUE,
  "expiresAt" timestamp(3) NOT NULL,
  "usedAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "AccountInvite_expiresAt_usedAt_idx" ON "AccountInvite"("expiresAt","usedAt");
ALTER TABLE "AccountInvite" ENABLE ROW LEVEL SECURITY;
