-- Add 'quote_link' value to sms_template_category enum so the seeded
-- "Quote Link" template can be persisted. The ensureSeed() backfill in
-- sms.controller.ts inserts the default row the next time an admin opens
-- the SMS templates page.

ALTER TYPE "sms_template_category" ADD VALUE IF NOT EXISTS 'quote_link';
