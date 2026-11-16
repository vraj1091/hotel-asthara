-- Database-level double-booking guard.
-- Run once after `prisma db push`:  npm run db:constraints
-- Two ACTIVE booking rows for the same room can never have overlapping stays.
-- The application also takes an advisory lock inside a transaction (lib/booking-engine.ts),
-- so users see a friendly "just sold out" message instead of a raw constraint error.

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "BookingRoom" DROP CONSTRAINT IF EXISTS booking_room_no_overlap;

ALTER TABLE "BookingRoom"
  ADD CONSTRAINT booking_room_no_overlap
  EXCLUDE USING gist (
    "roomId" WITH =,
    daterange("checkIn", "checkOut", '[)') WITH &&
  )
  WHERE ("active");

ALTER TABLE "BookingRoom" DROP CONSTRAINT IF EXISTS booking_room_valid_dates;
ALTER TABLE "BookingRoom"
  ADD CONSTRAINT booking_room_valid_dates CHECK ("checkOut" > "checkIn");
