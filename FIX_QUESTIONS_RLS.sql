-- Fix RLS policies for questions table
-- Run this in Supabase SQL Editor to fix the RLS error when creating questions

-- First, create a helper function to check admin email (SECURITY DEFINER allows access to auth.users)
CREATE OR REPLACE FUNCTION public.is_admin_email(_email TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND LOWER(TRIM(email)) = LOWER(TRIM(_email))
  )
$$;

-- Drop existing policies (idempotent)
DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can insert questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can update questions" ON public.questions;
DROP POLICY IF EXISTS "Admins can delete questions" ON public.questions;
DROP POLICY IF EXISTS "Admin email can manage questions" ON public.questions;

-- Create SELECT policy (anyone can view)
CREATE POLICY "Anyone can view questions" ON public.questions
  FOR SELECT USING (true);

-- Create separate policies for INSERT, UPDATE, DELETE
-- INSERT policy (needs WITH CHECK)
CREATE POLICY "Admins can insert questions" ON public.questions
  FOR INSERT WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_email('mohimmolla020@gmail.com')
  );

-- UPDATE policy
CREATE POLICY "Admins can update questions" ON public.questions
  FOR UPDATE 
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_email('mohimmolla020@gmail.com')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_email('mohimmolla020@gmail.com')
  );

-- DELETE policy
CREATE POLICY "Admins can delete questions" ON public.questions
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin')
    OR public.is_admin_email('mohimmolla020@gmail.com')
  );

