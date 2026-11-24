ALTER TABLE "Cleaner" ADD COLUMN "legalStatus" text;
ALTER TABLE "Cleaner" ADD COLUMN "taxReference" text;
ALTER TABLE "Booking" ADD COLUMN "seriesActive" boolean NOT NULL DEFAULT true;
ALTER TABLE "Occurrence" ADD COLUMN "confirmedAt" timestamp(3);
ALTER TABLE "Occurrence" ADD COLUMN "settledAt" timestamp(3);
ALTER TABLE "Document" ADD COLUMN "originalName" text;
ALTER TABLE "Document" ADD COLUMN "mimeType" text;
ALTER TABLE "Document" ADD COLUMN "sizeBytes" integer;
ALTER TABLE "Document" ADD COLUMN "status" text NOT NULL DEFAULT 'PENDING';

CREATE TABLE "Notification"(
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL REFERENCES "Account"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "subject" text NOT NULL,
  "body" text NOT NULL,
  "readAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "Notification_accountId_readAt_createdAt_idx" ON "Notification"("accountId","readAt","createdAt");

CREATE TABLE "Invoice"(
  "id" text PRIMARY KEY,
  "occurrenceId" text NOT NULL UNIQUE REFERENCES "Occurrence"("id") ON DELETE CASCADE,
  "number" text NOT NULL UNIQUE,
  "amountCents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "status" text NOT NULL DEFAULT 'ISSUED',
  "issuedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Payout"(
  "id" text PRIMARY KEY,
  "occurrenceId" text NOT NULL UNIQUE REFERENCES "Occurrence"("id") ON DELETE CASCADE,
  "cleanerId" text NOT NULL REFERENCES "Cleaner"("id"),
  "amountCents" integer NOT NULL,
  "currency" text NOT NULL DEFAULT 'EUR',
  "status" text NOT NULL DEFAULT 'DEMO_PENDING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "paidAt" timestamp(3)
);
CREATE INDEX "Payout_cleanerId_status_createdAt_idx" ON "Payout"("cleanerId","status","createdAt");

CREATE TABLE "WaitlistEntry"(
  "id" text PRIMARY KEY,
  "email" text NOT NULL,
  "postcode" text NOT NULL,
  "status" text NOT NULL DEFAULT 'WAITING',
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE("email","postcode")
);
CREATE INDEX "WaitlistEntry_postcode_status_idx" ON "WaitlistEntry"("postcode","status");

ALTER TABLE "Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payout" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WaitlistEntry" ENABLE ROW LEVEL SECURITY;
