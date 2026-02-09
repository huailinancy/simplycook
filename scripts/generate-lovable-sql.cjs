const fs = require('fs');
const recipes = JSON.parse(fs.readFileSync('recipes-export.json', 'utf8'));

let sql = `-- SimplyCook Database Setup for Lovable
-- Run this ENTIRE script in Lovable's Supabase SQL Editor

-- =============================================
-- PART 1: CREATE TABLES
-- =============================================

-- Create recipes table
CREATE TABLE IF NOT EXISTS recipes (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  english_name TEXT,
  meal_type JSONB DEFAULT '[]',
  cuisine TEXT,
  category TEXT,
  prep_time INTEGER,
  cook_time INTEGER,
  difficulty TEXT,
  calories INTEGER,
  macros JSONB DEFAULT '{}',
  ingredients JSONB DEFAULT '[]',
  instructions JSONB DEFAULT '[]',
  tags JSONB DEFAULT '[]',
  image_url TEXT,
  english_ingredients JSONB,
  english_instructions JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_published BOOLEAN DEFAULT FALSE,
  save_count INTEGER DEFAULT 0
);

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  allergies TEXT[] DEFAULT '{}',
  flavor_preferences TEXT[] DEFAULT '{}',
  diet_preferences TEXT[] DEFAULT '{}',
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create saved_recipes table
CREATE TABLE IF NOT EXISTS saved_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, recipe_id)
);

-- Create meal_plans table
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  meal_slots JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- PART 2: ENABLE RLS AND CREATE POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

-- Recipes policies
DROP POLICY IF EXISTS "Anyone can view system recipes" ON recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can insert own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update own recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete own recipes" ON recipes;

CREATE POLICY "Anyone can view system recipes" ON recipes FOR SELECT USING (user_id IS NULL);
CREATE POLICY "Anyone can view published recipes" ON recipes FOR SELECT USING (is_published = TRUE);
CREATE POLICY "Users can view own recipes" ON recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own recipes" ON recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own recipes" ON recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own recipes" ON recipes FOR DELETE USING (auth.uid() = user_id);

-- User profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON user_profiles;

CREATE POLICY "Users can view own profile" ON user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON user_profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Saved recipes policies
DROP POLICY IF EXISTS "Users can view own saved" ON saved_recipes;
DROP POLICY IF EXISTS "Users can insert own saved" ON saved_recipes;
DROP POLICY IF EXISTS "Users can delete own saved" ON saved_recipes;

CREATE POLICY "Users can view own saved" ON saved_recipes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own saved" ON saved_recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved" ON saved_recipes FOR DELETE USING (auth.uid() = user_id);

-- Meal plans policies
DROP POLICY IF EXISTS "Users can view own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can insert own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can delete own meal plans" ON meal_plans;

CREATE POLICY "Users can view own meal plans" ON meal_plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON meal_plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON meal_plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON meal_plans FOR DELETE USING (auth.uid() = user_id);

-- =============================================
-- PART 3: CREATE FUNCTIONS AND TRIGGERS
-- =============================================

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

DROP TRIGGER IF EXISTS update_meal_plans_updated_at ON meal_plans;
CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- PART 4: INSERT RECIPES DATA
-- =============================================

`;

// Generate INSERT statements for each recipe
recipes.forEach(r => {
  const escape = (s) => s ? s.replace(/'/g, "''") : null;

  const name = escape(r.name);
  const desc = escape(r.description);
  const englishName = r.english_name ? "'" + escape(r.english_name) + "'" : 'NULL';
  const cuisine = escape(r.cuisine);
  const category = escape(r.category);
  const difficulty = escape(r.difficulty);
  const imageUrl = r.image_url ? "'" + escape(r.image_url) + "'" : 'NULL';
  const mealType = JSON.stringify(r.meal_type || []).replace(/'/g, "''");
  const ingredients = JSON.stringify(r.ingredients || []).replace(/'/g, "''");
  const instructions = JSON.stringify(r.instructions || []).replace(/'/g, "''");
  const macros = JSON.stringify(r.macros || {}).replace(/'/g, "''");
  const tags = JSON.stringify(r.tags || []).replace(/'/g, "''");
  const englishIngredients = r.english_ingredients ? "'" + JSON.stringify(r.english_ingredients).replace(/'/g, "''") + "'::jsonb" : 'NULL';
  const englishInstructions = r.english_instructions ? "'" + JSON.stringify(r.english_instructions).replace(/'/g, "''") + "'::jsonb" : 'NULL';

  sql += `INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('${name}', '${desc}', ${englishName}, '${mealType}'::jsonb, '${cuisine}', '${category}', ${r.prep_time || 'NULL'}, ${r.cook_time || 'NULL'}, '${difficulty}', ${r.calories || 'NULL'}, '${macros}'::jsonb, '${ingredients}'::jsonb, '${instructions}'::jsonb, '${tags}'::jsonb, ${imageUrl}, ${englishIngredients}, ${englishInstructions}, NULL, FALSE, 0);

`;
});

sql += `
-- =============================================
-- DONE! Verify the import:
-- =============================================
SELECT COUNT(*) as total_recipes FROM recipes;
`;

fs.writeFileSync('lovable-complete-setup.sql', sql);
console.log('Created lovable-complete-setup.sql with ' + recipes.length + ' recipes');
console.log('File size: ' + (fs.statSync('lovable-complete-setup.sql').size / 1024).toFixed(1) + ' KB');
