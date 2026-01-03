# Fix RLS Policy for quiz_settings

## Problem
The RLS policy for `quiz_settings` table was using `FOR ALL USING` which doesn't work for INSERT operations. INSERT requires `WITH CHECK` clause.

## Solution

You have two options:

### Option 1: Run the new migration (Recommended)
Run the new migration file that fixes the RLS policies:

```sql
-- File: supabase/migrations/20251226000001_fix_quiz_settings_rls.sql
```

This migration:
1. Drops the old policies
2. Creates separate policies for SELECT, INSERT, UPDATE, DELETE
3. Adds a fallback policy that checks the admin email directly

### Option 2: Run SQL directly in Supabase Dashboard

1. Go to your Supabase Dashboard
2. Navigate to SQL Editor
3. Run this SQL:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.quiz_settings;

-- Create separate policies
CREATE POLICY "Admins can view settings" ON public.quiz_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings" ON public.quiz_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update settings" ON public.quiz_settings
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete settings" ON public.quiz_settings
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Fallback policy for admin email
CREATE POLICY "Admin email can manage settings" ON public.quiz_settings
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND LOWER(TRIM(email)) = 'mohimmolla020@gmail.com'
    )
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
      AND LOWER(TRIM(email)) = 'mohimmolla020@gmail.com'
    )
    OR public.has_role(auth.uid(), 'admin')
  );
```

## Verify Admin Role

After running the migration, make sure your admin user has the role:

```sql
-- Check if admin role exists
SELECT * FROM public.user_roles 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'mohimmolla020@gmail.com');

-- If not, insert it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'mohimmolla020@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;
```

## Test

After applying the fix, try saving SMTP configuration again from the admin panel.
