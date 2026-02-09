-- Create meal_plans table to store weekly meal plans
CREATE TABLE IF NOT EXISTS meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  is_finalized BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, week_start)
);

-- Create meal_plan_items table to store individual meals in a plan
CREATE TABLE IF NOT EXISTS meal_plan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  recipe_id INTEGER NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Monday, 6 = Sunday
  meal_type TEXT NOT NULL CHECK (meal_type IN ('lunch', 'dinner')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meal_plan_id, day_of_week, meal_type)
);

-- Create grocery_lists table
CREATE TABLE IF NOT EXISTS grocery_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create grocery_list_items table
CREATE TABLE IF NOT EXISTS grocery_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grocery_list_id UUID NOT NULL REFERENCES grocery_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'item',
  category TEXT NOT NULL DEFAULT 'Other',
  checked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE grocery_list_items ENABLE ROW LEVEL SECURITY;

-- Meal plans policies
CREATE POLICY "Users can view own meal plans" ON meal_plans
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own meal plans" ON meal_plans
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own meal plans" ON meal_plans
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own meal plans" ON meal_plans
  FOR DELETE USING (auth.uid() = user_id);

-- Meal plan items policies (through meal_plan ownership)
CREATE POLICY "Users can view own meal plan items" ON meal_plan_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own meal plan items" ON meal_plan_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );
CREATE POLICY "Users can update own meal plan items" ON meal_plan_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own meal plan items" ON meal_plan_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM meal_plans WHERE meal_plans.id = meal_plan_items.meal_plan_id AND meal_plans.user_id = auth.uid())
  );

-- Grocery lists policies
CREATE POLICY "Users can view own grocery lists" ON grocery_lists
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own grocery lists" ON grocery_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grocery lists" ON grocery_lists
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grocery lists" ON grocery_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Grocery list items policies
CREATE POLICY "Users can view own grocery list items" ON grocery_list_items
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid())
  );
CREATE POLICY "Users can insert own grocery list items" ON grocery_list_items
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid())
  );
CREATE POLICY "Users can update own grocery list items" ON grocery_list_items
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid())
  );
CREATE POLICY "Users can delete own grocery list items" ON grocery_list_items
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM grocery_lists WHERE grocery_lists.id = grocery_list_items.grocery_list_id AND grocery_lists.user_id = auth.uid())
  );

-- Trigger to update updated_at
CREATE TRIGGER update_meal_plans_updated_at
  BEFORE UPDATE ON meal_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_grocery_lists_updated_at
  BEFORE UPDATE ON grocery_lists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
