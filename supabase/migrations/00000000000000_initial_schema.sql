-- ============================================
-- WordPress Developer Quiz - Complete Database Schema
-- ============================================
-- This file contains all database migrations combined into one
-- Run this file to set up the complete database schema
-- ============================================

-- ============================================
-- 1. CREATE ENUMS
-- ============================================

-- Create app_role enum (idempotent)
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create difficulty enum (idempotent)
DO $$ BEGIN
  CREATE TYPE public.difficulty_level AS ENUM ('beginner', 'intermediate', 'advanced');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create quiz_type enum (idempotent)
DO $$ BEGIN
  CREATE TYPE public.quiz_type AS ENUM ('plugin', 'theme');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- ============================================
-- 2. CREATE TABLES
-- ============================================

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  email_verified BOOLEAN NOT NULL DEFAULT false,
  is_blocked BOOLEAN NOT NULL DEFAULT false,
  blocked_reason TEXT,
  blocked_at TIMESTAMP WITH TIME ZONE,
  violation_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create questions table for admin-managed questions
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_type quiz_type NOT NULL,
  difficulty difficulty_level NOT NULL DEFAULT 'intermediate',
  question TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_answer INTEGER NOT NULL,
  explanation TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_results table
CREATE TABLE IF NOT EXISTS public.quiz_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  quiz_type quiz_type NOT NULL,
  difficulty difficulty_level NOT NULL,
  score INTEGER NOT NULL,
  total_questions INTEGER NOT NULL,
  time_taken_seconds INTEGER NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create quiz_settings table for configurable settings
CREATE TABLE IF NOT EXISTS public.quiz_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blocked_users table to log blocking events
CREATE TABLE IF NOT EXISTS public.blocked_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_by UUID REFERENCES auth.users(id),
  reason TEXT,
  violation_type TEXT,
  unblocked_at TIMESTAMP WITH TIME ZONE,
  unblocked_by UUID REFERENCES auth.users(id)
);

-- ============================================
-- 3. ADD FOREIGN KEY CONSTRAINTS
-- ============================================

-- Add foreign key from quiz_results to profiles (idempotent)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'quiz_results_user_id_profiles_fkey'
  ) THEN
    ALTER TABLE public.quiz_results 
    ADD CONSTRAINT quiz_results_user_id_profiles_fkey 
    FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================
-- 4. ENABLE ROW LEVEL SECURITY (RLS)
-- ============================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. CREATE FUNCTIONS
-- ============================================

-- Create has_role function for secure role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create trigger function for updating timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name, email_verified, is_blocked, violation_count)
  VALUES (
    NEW.id, 
    NEW.raw_user_meta_data ->> 'display_name',
    COALESCE((NEW.raw_user_meta_data ->> 'email_verified')::boolean, false),
    false,
    0
  );
  RETURN NEW;
END;
$$;

-- ============================================
-- 6. CREATE TRIGGERS
-- ============================================

-- Trigger for updating profiles updated_at (idempotent)
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating questions updated_at (idempotent)
DROP TRIGGER IF EXISTS update_questions_updated_at ON public.questions;
CREATE TRIGGER update_questions_updated_at
  BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating quiz_settings updated_at (idempotent)
DROP TRIGGER IF EXISTS update_quiz_settings_updated_at ON public.quiz_settings;
CREATE TRIGGER update_quiz_settings_updated_at
  BEFORE UPDATE ON public.quiz_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to auto-create profile on user signup (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- 7. CREATE ROW LEVEL SECURITY POLICIES
-- ============================================

-- Drop existing policies if they exist (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;
  DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
  DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
END $$;

-- Profiles policies
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Drop existing user_roles policies (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
  DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
END $$;

-- User roles policies (only admins can manage roles)
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles" ON public.user_roles
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing questions policies (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Anyone can view questions" ON public.questions;
  DROP POLICY IF EXISTS "Admins can manage questions" ON public.questions;
END $$;

-- Questions policies (public read, admin write)
CREATE POLICY "Anyone can view questions" ON public.questions
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage questions" ON public.questions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Drop existing quiz_results policies (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view all results" ON public.quiz_results;
  DROP POLICY IF EXISTS "Users can insert own results" ON public.quiz_results;
END $$;

-- Quiz results policies
CREATE POLICY "Users can view all results" ON public.quiz_results
  FOR SELECT USING (true);

CREATE POLICY "Users can insert own results" ON public.quiz_results
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Drop existing quiz_settings policies (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view settings" ON public.quiz_settings;
  DROP POLICY IF EXISTS "Admins can manage settings" ON public.quiz_settings;
  DROP POLICY IF EXISTS "Admins can insert settings" ON public.quiz_settings;
  DROP POLICY IF EXISTS "Admins can update settings" ON public.quiz_settings;
  DROP POLICY IF EXISTS "Admins can delete settings" ON public.quiz_settings;
  DROP POLICY IF EXISTS "Admin email can manage settings" ON public.quiz_settings;
END $$;

-- Quiz settings policies (admin only for security)
-- Separate policies for SELECT, INSERT, UPDATE, DELETE with proper WITH CHECK
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

-- Drop existing blocked_users policies (idempotent)
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Admins can view blocked users" ON public.blocked_users;
  DROP POLICY IF EXISTS "Admins can manage blocked users" ON public.blocked_users;
  DROP POLICY IF EXISTS "Users can view own blocking status" ON public.blocked_users;
END $$;

-- Blocked users policies
CREATE POLICY "Admins can view blocked users" ON public.blocked_users
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage blocked users" ON public.blocked_users
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own blocking status" ON public.blocked_users
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================
-- 8. INSERT DEFAULT DATA (OPTIONAL)
-- ============================================

-- Insert default quiz duration (20 minutes)
INSERT INTO public.quiz_settings (setting_key, setting_value)
VALUES ('quiz_duration_minutes', '20')
ON CONFLICT (setting_key) DO NOTHING;

-- ============================================
-- END OF SCHEMA
-- ============================================
