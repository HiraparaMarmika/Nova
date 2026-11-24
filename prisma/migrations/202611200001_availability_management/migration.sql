ALTER TABLE "Cleaner"
  ADD COLUMN "acceptingBookings" boolean NOT NULL DEFAULT true;

CREATE TABLE "AvailabilityBlock" (
  "id" text PRIMARY KEY,
  "cleanerId" text NOT NULL REFERENCES "Cleaner"("id") ON DELETE CASCADE,
  "date" date NOT NULL,
  "reason" text NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AvailabilityBlock_cleanerId_date_key" UNIQUE ("cleanerId", "date")
);

CREATE INDEX "AvailabilityBlock_date_idx" ON "AvailabilityBlock"("date");
