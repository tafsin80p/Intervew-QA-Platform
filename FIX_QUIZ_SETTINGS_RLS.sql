-- Fix RLS policies for quiz_settings table
-- This fixes the "permission denied for table users" error
-- Run this in Supabase SQL Editor

-- Create is_admin_email function for secure email checking (if it doesn't exist)
CREATE OR REPLACE FUNCTION public.is_admin_email(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = _user_id
    AND LOWER(TRIM(email)) = 'mohimmolla020@gmail.com'
  )
$$;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins can view settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can manage settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can update settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admins can delete settings" ON public.quiz_settings;
DROP POLICY IF EXISTS "Admin email can manage settings" ON public.quiz_settings;

-- Create SELECT policy (anyone can view, or admins)
CREATE POLICY "Admins can view settings" ON public.quiz_settings
  FOR SELECT USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.is_admin_email(auth.uid())
  );

-- Create INSERT policy (needs WITH CHECK)
CREATE POLICY "Admins can insert settings" ON public.quiz_settings
  FOR INSERT 
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.is_admin_email(auth.uid())
  );

-- Create UPDATE policy
CREATE POLICY "Admins can update settings" ON public.quiz_settings
  FOR UPDATE 
  USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.is_admin_email(auth.uid())
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') 
    OR public.is_admin_email(auth.uid())
  );

-- Create DELETE policy
CREATE POLICY "Admins can delete settings" ON public.quiz_settings
  FOR DELETE USING (
    public.has_role(auth.uid(), 'admin') 
    OR public.is_admin_email(auth.uid())
  );

