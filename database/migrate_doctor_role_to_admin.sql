-- ============================================================
-- One-time migration: simplify roles by converting doctor -> admin
-- ============================================================
-- Run this once in Supabase SQL Editor if you want to clean old auth metadata.
-- The application already maps legacy role="doctor" to admin in code, so this
-- migration is safe to run later and is not required before deploying.

-- 1) Move old doctor role into app_metadata as admin.
-- If app_metadata already has a non-doctor role, keep it and only clean the
-- stale user_metadata role in step 2.
UPDATE auth.users
SET
  raw_app_meta_data = jsonb_set(
    COALESCE(raw_app_meta_data, '{}'::jsonb),
    '{role}',
    '"admin"',
    true
  ),
  updated_at = NOW()
WHERE LOWER(COALESCE(raw_app_meta_data->>'role', '')) = 'doctor'
   OR (
    COALESCE(raw_app_meta_data->>'role', '') = ''
    AND LOWER(COALESCE(raw_user_meta_data->>'role', '')) = 'doctor'
  );

-- 2) Remove stale role from user_metadata.
-- Authorization should live in app_metadata only.
UPDATE auth.users
SET
  raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) - 'role',
  updated_at = NOW()
WHERE LOWER(COALESCE(raw_user_meta_data->>'role', '')) = 'doctor';

