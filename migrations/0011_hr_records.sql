-- HR rewrite: drop the seed-only hr_employees / hr_reminders tables and
-- replace them with hr_records, keyed to user.id. Branch scoping now
-- flows through branch_members instead of being baked into the table.
--
-- Reminders (probation ending, contract ending, start anniversaries,
-- birthdays) are derived in the service layer, so no replacement table.

DROP TABLE IF EXISTS hr_reminders;
DROP TABLE IF EXISTS hr_employees;

CREATE TABLE hr_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES organization(id) ON DELETE CASCADE,
  user_id text NOT NULL UNIQUE REFERENCES "user"(id) ON DELETE CASCADE,
  status varchar(32) NOT NULL DEFAULT 'Active',
  employment_type varchar(32) NOT NULL DEFAULT 'Full-time',
  start_date date,
  probation_end date,
  manager_user_id text REFERENCES "user"(id) ON DELETE SET NULL,
  salary numeric(12, 2),
  salary_currency varchar(3),
  contract_type varchar(32),
  contract_end_date date,
  holiday_allowance integer,
  tax_id text,
  holidays jsonb NOT NULL DEFAULT '[]'::jsonb,
  documents jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_hr_records_org_id ON hr_records (org_id);
CREATE INDEX idx_hr_records_manager_user_id ON hr_records (manager_user_id);
