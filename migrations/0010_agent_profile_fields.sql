-- Agent onboarding capture: address + emergency contact.
--
-- These live on user_profiles (not the core user table) so the user row
-- stays auth-focused. All fields are nullable so existing profile rows
-- remain valid.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relationship text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;
