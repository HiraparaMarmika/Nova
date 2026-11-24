CREATE TABLE "BookingMessage" (
  "id" text PRIMARY KEY,
  "bookingId" text NOT NULL,
  "senderAccountId" text NOT NULL,
  "body" text NOT NULL,
  "readAt" timestamp(3),
  "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingMessage_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE,
  CONSTRAINT "BookingMessage_senderAccountId_fkey" FOREIGN KEY ("senderAccountId") REFERENCES "Account"("id") ON DELETE CASCADE
);

CREATE INDEX "BookingMessage_bookingId_createdAt_idx" ON "BookingMessage"("bookingId", "createdAt");
CREATE INDEX "BookingMessage_senderAccountId_createdAt_idx" ON "BookingMessage"("senderAccountId", "createdAt");
