-- ============================================================
-- Vivra — iOS TestFlight waitlist table
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS ios_waitlist (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Allow anonymous inserts (landing page form, no auth required)
ALTER TABLE ios_waitlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can sign up for waitlist"
  ON ios_waitlist FOR INSERT
  WITH CHECK (true);

-- Only admin can read the list (via service_role key in dashboard)
-- No SELECT policy for anon = emails are private
