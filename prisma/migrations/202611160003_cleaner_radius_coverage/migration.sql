ALTER TABLE "Cleaner"
  ADD COLUMN "basePostcode" text,
  ADD COLUMN "serviceRadiusKm" integer;

CREATE TABLE "PostcodeLocation" (
  "postcode" text PRIMARY KEY,
  "latitude" double precision NOT NULL,
  "longitude" double precision NOT NULL,
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" timestamp(3) NOT NULL
);
