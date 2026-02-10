-- Fix Recipe Access for SimplyCook
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add missing columns to recipes table (if they don't exist)
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0;

-- 2. Enable Row Level Security on recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- 3. Drop existing policies (to avoid conflicts)
DROP POLICY IF EXISTS "Anyone can view system recipes" ON recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
DROP POLICY IF EXISTS "Public read access" ON recipes;
DROP POLICY IF EXISTS "Enable read access for all users" ON recipes;

-- 4. Create policies for recipe visibility
-- Allow anyone to view system recipes (where user_id is NULL)
CREATE POLICY "Anyone can view system recipes" ON recipes
  FOR SELECT USING (user_id IS NULL);

-- Allow anyone to view published user recipes
CREATE POLICY "Anyone can view published recipes" ON recipes
  FOR SELECT USING (is_published = TRUE);

-- Allow users to view their own recipes
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = user_id);

-- Allow users to create their own recipes
CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own recipes
CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = user_id);

-- Allow users to delete their own recipes
CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (auth.uid() = user_id);

-- 5. Verify: Check if recipes exist and are accessible
SELECT COUNT(*) as total_recipes,
       COUNT(*) FILTER (WHERE user_id IS NULL) as system_recipes,
       COUNT(*) FILTER (WHERE is_published = TRUE) as published_recipes
FROM recipes;
