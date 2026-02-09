-- Fix Migration: Handle existing schema and type mismatches

-- ============================================
-- 1. Fix user_profiles table
-- ============================================

-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

-- Drop and recreate the table with correct schema
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allergies TEXT[] DEFAULT '{}',
  flavor_preferences TEXT[] DEFAULT '{}',
  diet_preferences TEXT[] DEFAULT '{}',
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. Create saved_recipes table
-- ============================================
DROP TABLE IF EXISTS saved_recipes CASCADE;

CREATE TABLE saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own saved" ON saved_recipes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved" ON saved_recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved" ON saved_recipes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. Add columns to recipes table
-- ============================================
ALTER TABLE recipes
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS save_count INTEGER DEFAULT 0;

-- Enable RLS on recipes
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;

-- Drop existing recipe policies
DROP POLICY IF EXISTS "Anyone can view system recipes" ON recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;
DROP POLICY IF EXISTS "Public read access" ON recipes;

-- Create new policies
CREATE POLICY "Anyone can view system recipes" ON recipes
  FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Anyone can view published recipes" ON recipes
  FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Users can view own recipes" ON recipes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON recipes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON recipes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON recipes
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. Create triggers and functions
-- ============================================
CREATE OR REPLACE FUNCTION update_recipe_save_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE recipes SET save_count = save_count + 1 WHERE id = NEW.recipe_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE recipes SET save_count = save_count - 1 WHERE id = OLD.recipe_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_save_change ON saved_recipes;
CREATE TRIGGER on_save_change
  AFTER INSERT OR DELETE ON saved_recipes
  FOR EACH ROW EXECUTE FUNCTION update_recipe_save_count();

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
