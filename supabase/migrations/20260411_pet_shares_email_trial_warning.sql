-- Add co-owner display name/email to pet_shares
ALTER TABLE pet_shares ADD COLUMN IF NOT EXISTS shared_with_email TEXT;
ALTER TABLE pet_shares ADD COLUMN IF NOT EXISTS shared_with_name TEXT;
