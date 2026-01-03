-- Quick fix for quiz_settings RLS policies
-- Run this in Supabase SQL Editor to fix the RLS error

-- Drop ALL existing policies (idempotent)
DROP POLICY IF EXISTS "Admins can view settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admin email can manage settings" ON public.quiz_settings;

-- Create separate policies for better control
-- SELECT policy
CREATE POLICY "Admins can view settings" ON public.quiz_settings
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- INSERT policy (needs WITH CHECK)
CREATE POLICY "Admins can insert settings" ON public.quiz_settings
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE policy
CREATE POLICY "Admins can update settings" ON public.quiz_settings
  FOR UPDATE 
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- DELETE policy
CREATE POLICY "Admins can delete settings" ON public.quiz_settings
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Fallback policy: Allow admin email to manage settings if role check fails
-- This ensures the specific admin email can always access settings
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
