-- Make hr_employees and hr_reminders per-organisation.
--
-- Existing rows are wiped (per the design call — they were unscoped and
-- untrustworthy in a multi-tenant deployment). Each table gains a NOT NULL
-- org_id FK to organization(id).
--
-- The other 'global' Phase D tables (hub_posts, announcements,
-- destination_guru, feedback) stay schema-global by design. Write access on
-- those is enforced in route middleware (`requireOrgRole`), not the schema.

DELETE FROM hr_employees;
DELETE FROM hr_reminders;

ALTER TABLE hr_employees
  ADD COLUMN org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE;

ALTER TABLE hr_reminders
  ADD COLUMN org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE;

CREATE INDEX idx_hr_employees_org_id ON hr_employees (org_id);
CREATE INDEX idx_hr_reminders_org_id ON hr_reminders (org_id);
