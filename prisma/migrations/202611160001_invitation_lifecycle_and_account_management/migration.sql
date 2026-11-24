CREATE TYPE "InvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED');

ALTER TABLE "Account"
  ADD COLUMN "displayName" text,
  ADD COLUMN "phone" text;

ALTER TABLE "AccountInvite"
  ADD COLUMN "status" "InvitationStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "reason" text NOT NULL DEFAULT 'Administrator invitation',
  ADD COLUMN "invitedByAccountId" text NOT NULL DEFAULT '',
  ADD COLUMN "revokedAt" timestamp(3),
  ADD COLUMN "lastSentAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
