-- Deprecate 'on_tickets_uploaded' and 'weekly_schedule' SMS auto-triggers
-- (they were never actually wired up). Any rows currently using these
-- triggers are coerced to 'manual' so the editor UI doesn't show a blank
-- trigger and so the new auto-fire engine doesn't have to handle them.
--
-- The enum values are intentionally left in the pgEnum — Postgres can't
-- drop an enum value cleanly, and leaving them costs nothing.

UPDATE sms_templates
   SET auto_trigger = 'manual',
       trigger_weekday = NULL,
       trigger_hour = CASE WHEN auto_trigger = 'weekly_schedule' THEN NULL ELSE trigger_hour END
 WHERE auto_trigger IN ('on_tickets_uploaded', 'weekly_schedule');
