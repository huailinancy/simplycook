-- SimplyCook Database Setup for Lovable
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

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('麻婆豆腐', '麻辣鲜香，豆腐嫩滑，经典川菜', 'mapo_tofu', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 10, 15, '中等', 280, '{"fat":18,"carbs":12,"fiber":2,"protein":15}'::jsonb, '[{"name":"嫩豆腐","unit":"克","quantity":300},{"name":"猪肉末","unit":"克","quantity":100},{"name":"郫县豆瓣酱","unit":"克","quantity":20},{"name":"花椒粉","unit":"克","quantity":5},{"name":"姜","unit":"克","quantity":10},{"name":"蒜","unit":"瓣","quantity":3},{"name":"小葱","unit":"根","quantity":2},{"name":"淀粉","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["豆腐切小块，放入开水中加盐焯烫2分钟捞出","热锅凉油，下猪肉末炒至变色","加入豆瓣酱、姜蒜末炒出红油","加入适量水烧开，放入豆腐块","小火煮5分钟让豆腐入味","水淀粉勾芡，轻轻推匀","撒上花椒粉和葱花即可"]'::jsonb, '["麻辣","下饭菜","川菜","素菜可调","经典"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/mapo_tofu.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('凉拌茄子', '夏日凉菜，茄子软糯，酱汁开胃', 'cold_eggplant_salad', '["午餐","晚餐"]'::jsonb, '中式', '凉菜', 10, 15, '简单', 120, '{"fat":8,"carbs":15,"fiber":6,"protein":3}'::jsonb, '[{"name":"茄子","unit":"根","quantity":2},{"name":"蒜","unit":"瓣","quantity":4},{"name":"生抽","unit":"毫升","quantity":15},{"name":"醋","unit":"毫升","quantity":10},{"name":"香油","unit":"毫升","quantity":5},{"name":"糖","unit":"克","quantity":5},{"name":"辣椒油","unit":"毫升","quantity":5}]'::jsonb, '["茄子洗净切段，上锅蒸15分钟","蒸熟的茄子放凉后撕成条","蒜切末，所有调料混合成酱汁","酱汁淋在茄子上拌匀","冷藏后食用更美味"]'::jsonb, '["凉菜","夏日","素菜","开胃","健康"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/cold_eggplant_salad.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('卤牛肉', '香气四溢，肉质酥烂，适合下酒', 'braised_beef', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 20, 120, '中等', 320, '{"fat":20,"carbs":5,"fiber":2,"protein":40}'::jsonb, '[{"name":"牛腱子肉","unit":"克","quantity":500},{"name":"八角","unit":"个","quantity":2},{"name":"桂皮","unit":"块","quantity":1},{"name":"香叶","unit":"片","quantity":3},{"name":"生抽","unit":"毫升","quantity":50},{"name":"老抽","unit":"毫升","quantity":20},{"name":"料酒","unit":"毫升","quantity":30},{"name":"冰糖","unit":"克","quantity":20}]'::jsonb, '["牛腱子肉冷水下锅焯水去血沫","锅中加入所有香料和调料","加入足量水，放入牛肉","大火烧开后转小火炖2小时","关火后让牛肉在卤汁中浸泡过夜更入味","切片装盘"]'::jsonb, '["卤味","下酒菜","耗时","传统","宴客菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/braised_beef.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('小炒牛肉', '湖南特色小炒，牛肉嫩滑，香辣下饭', 'stir_fried_beef', '["午餐","晚餐"]'::jsonb, '湘菜', '主菜', 15, 8, '中等', 280, '{"fat":15,"carbs":10,"fiber":3,"protein":30}'::jsonb, '[{"name":"牛肉","unit":"克","quantity":300},{"name":"小米椒","unit":"个","quantity":5},{"name":"香菜","unit":"克","quantity":50},{"name":"姜","unit":"克","quantity":10},{"name":"蒜","unit":"瓣","quantity":4},{"name":"生抽","unit":"毫升","quantity":15},{"name":"料酒","unit":"毫升","quantity":10},{"name":"淀粉","unit":"克","quantity":5}]'::jsonb, '["牛肉切片，用料酒、生抽、淀粉腌制","小米椒切圈，姜蒜切末，香菜切段","热锅凉油，快速滑炒牛肉至变色盛出","锅中留底油，爆香姜蒜和小米椒","倒入牛肉快速翻炒","加入香菜段，翻炒均匀出锅"]'::jsonb, '["湘菜","辣","下饭菜","快手菜","特色"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/stir_fried_beef.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('扁豆面旗子', '新疆汤面，面片如旗，扁豆软糯', 'flat_bean_noodle_soup', '["午餐","晚餐"]'::jsonb, '新疆菜', '汤面', 20, 30, '中等', 380, '{"fat":12,"carbs":50,"fiber":8,"protein":15}'::jsonb, '[{"name":"面粉","unit":"克","quantity":300},{"name":"扁豆","unit":"克","quantity":200},{"name":"羊肉","unit":"克","quantity":150},{"name":"土豆","unit":"个","quantity":1},{"name":"番茄","unit":"个","quantity":1},{"name":"洋葱","unit":"个","quantity":0.5},{"name":"盐","unit":"克","quantity":8}]'::jsonb, '["面粉和成面团，饧发30分钟","面团擀薄，切成菱形面片","羊肉切片，扁豆、土豆、番茄切块","锅中炒香羊肉和洋葱","加水烧开，放入所有蔬菜","煮15分钟后下入面片，煮至熟透","加盐调味即可"]'::jsonb, '["新疆菜","汤面","主食","传统","温暖"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/flat_bean_noodle_soup.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('水煮花生', '简单下酒菜，花生软糯入味', 'boiled_peanuts', '["前菜","小吃"]'::jsonb, '中式', '小吃', 5, 40, '简单', 180, '{"fat":12,"carbs":15,"fiber":6,"protein":8}'::jsonb, '[{"name":"生花生","unit":"克","quantity":300},{"name":"八角","unit":"个","quantity":2},{"name":"盐","unit":"克","quantity":15},{"name":"水","unit":"毫升","quantity":1000}]'::jsonb, '["花生洗净，用清水浸泡2小时","锅中加水，放入花生和八角","大火烧开后转小火煮40分钟","加盐继续煮10分钟","关火后让花生在汤中浸泡更入味"]'::jsonb, '["小吃","下酒菜","简单","健康零食","传统"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/boiled_peanuts.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('清蒸鱼', '原汁原味，鱼肉鲜嫩，健康美味', 'steamed_fish', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 12, '简单', 180, '{"fat":8,"carbs":2,"fiber":1,"protein":30}'::jsonb, '[{"name":"鲈鱼","unit":"条（约500克）","quantity":1},{"name":"姜","unit":"克","quantity":20},{"name":"葱","unit":"根","quantity":2},{"name":"蒸鱼豉油","unit":"毫升","quantity":30},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["鲈鱼清理干净，两面划几刀","鱼身内外抹少许盐，放姜片腌制10分钟","蒸锅水烧开，放入鲈鱼大火蒸8-10分钟","取出倒掉盘中多余水分","鱼身铺上葱丝，淋上热油","最后淋上蒸鱼豉油即可"]'::jsonb, '["海鲜","健康","清淡","宴客菜","快手菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/steamed_fish.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('烤羊排', '外焦里嫩，肉汁丰富，西北风味', 'roast_lamb_chops', '["午餐","晚餐"]'::jsonb, '西北菜', '主菜', 20, 30, '中等', 380, '{"fat":25,"carbs":5,"fiber":2,"protein":40}'::jsonb, '[{"name":"羊排","unit":"克","quantity":600},{"name":"孜然粉","unit":"克","quantity":15},{"name":"辣椒粉","unit":"克","quantity":8},{"name":"盐","unit":"克","quantity":10},{"name":"橄榄油","unit":"毫升","quantity":20},{"name":"迷迭香","unit":"枝","quantity":2}]'::jsonb, '["羊排洗净，用厨房纸吸干水分","两面均匀涂抹盐、孜然粉、辣椒粉","淋上橄榄油，按摩均匀，腌制1小时","烤箱预热200度，放入羊排","烤20分钟后翻面再烤10分钟","取出后撒上新鲜迷迭香"]'::jsonb, '["西北菜","羊肉","烤制","宴客菜","节日"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/roast_lamb_chops.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('白菜豆腐', '家常炖菜，清淡营养，温暖舒适', 'cabbage_tofu_stew', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 10, 15, '简单', 160, '{"fat":8,"carbs":15,"fiber":6,"protein":12}'::jsonb, '[{"name":"大白菜","unit":"克","quantity":300},{"name":"豆腐","unit":"克","quantity":300},{"name":"香菇","unit":"朵","quantity":5},{"name":"姜","unit":"克","quantity":10},{"name":"盐","unit":"克","quantity":5},{"name":"香油","unit":"毫升","quantity":5}]'::jsonb, '["白菜洗净切块，豆腐切块","香菇泡发切片，姜切片","锅中加水烧开，放入姜片和香菇","煮5分钟后加入白菜","再煮5分钟后放入豆腐","煮至所有食材软烂，加盐调味","淋香油出锅"]'::jsonb, '["素菜","炖菜","清淡","温暖","冬季"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/cabbage_tofu_stew.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('肉末茄子', '茄子软糯，肉末鲜香，下饭神器', 'minced_pork_eggplant', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 12, '中等', 280, '{"fat":18,"carbs":20,"fiber":6,"protein":18}'::jsonb, '[{"name":"茄子","unit":"根","quantity":2},{"name":"猪肉末","unit":"克","quantity":150},{"name":"豆瓣酱","unit":"克","quantity":15},{"name":"蒜","unit":"瓣","quantity":4},{"name":"生抽","unit":"毫升","quantity":10},{"name":"糖","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":25}]'::jsonb, '["茄子切条，用盐水浸泡防止氧化","热锅多油，将茄子炸软捞出沥油","锅中留底油，炒香肉末","加入豆瓣酱、蒜末炒出红油","放入茄子翻炒均匀","加生抽、糖和少许水焖煮2分钟","大火收汁即可"]'::jsonb, '["下饭菜","经典","家常","快手菜","茄子"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/minced_pork_eggplant.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('葱烧豆腐', '葱香浓郁，豆腐入味，简单美味', 'scallion_braised_tofu', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 10, 10, '简单', 190, '{"fat":12,"carbs":10,"fiber":3,"protein":15}'::jsonb, '[{"name":"老豆腐","unit":"克","quantity":400},{"name":"大葱","unit":"根","quantity":2},{"name":"生抽","unit":"毫升","quantity":15},{"name":"老抽","unit":"毫升","quantity":5},{"name":"糖","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["豆腐切厚片，大葱切段","热锅凉油，将豆腐煎至两面金黄","加入葱段炒出香味","加生抽、老抽、糖和少量水","中小火炖煮5分钟让豆腐入味","大火收汁即可出锅"]'::jsonb, '["素菜","葱香","快手菜","家常","下饭菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/scallion_braised_tofu.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('蒜蓉娃娃菜', '蒜香浓郁，娃娃菜清甜爽口', 'garlic_baby_cabbage', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 8, 8, '简单', 90, '{"fat":5,"carbs":10,"fiber":4,"protein":3}'::jsonb, '[{"name":"娃娃菜","unit":"棵","quantity":2},{"name":"蒜","unit":"瓣","quantity":6},{"name":"生抽","unit":"毫升","quantity":10},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":10}]'::jsonb, '["娃娃菜洗净，对半切开或切四瓣","蒜切末，分成两份","烧一锅水，加少许盐和油","娃娃菜焯烫2分钟捞出沥干","热锅凉油，爆香一半蒜末","放入娃娃菜翻炒","加生抽和剩余蒜末，翻炒均匀"]'::jsonb, '["素菜","蒜香","快手菜","清淡","低卡"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/garlic_baby_cabbage.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('西湖牛肉羹', '杭州名汤，牛肉嫩滑，羹汤鲜美', 'west_lake_beef_soup', '["午餐","晚餐"]'::jsonb, '浙菜', '汤羹', 15, 10, '中等', 150, '{"fat":8,"carbs":10,"fiber":2,"protein":15}'::jsonb, '[{"name":"牛肉末","unit":"克","quantity":100},{"name":"香菇","unit":"朵","quantity":3},{"name":"豆腐","unit":"克","quantity":100},{"name":"鸡蛋清","unit":"个","quantity":1},{"name":"淀粉","unit":"克","quantity":10},{"name":"盐","unit":"克","quantity":5},{"name":"白胡椒粉","unit":"克","quantity":2}]'::jsonb, '["牛肉末用少许盐和淀粉腌制","香菇、豆腐切细丝","锅中加水烧开，放入香菇丝","煮5分钟后加入牛肉末搅散","放入豆腐丝煮开","水淀粉勾芡，缓缓倒入蛋清形成蛋花","加盐和白胡椒粉调味"]'::jsonb, '["浙菜","汤羹","经典","宴客菜","鲜美"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/west_lake_beef_soup.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('西葫芦饼', '外酥里嫩，西葫芦清甜，早餐佳品', 'zucchini_pancake', '["早餐"]'::jsonb, '中式', '早餐', 10, 8, '简单', 180, '{"fat":8,"carbs":25,"fiber":4,"protein":6}'::jsonb, '[{"name":"西葫芦","unit":"个","quantity":1},{"name":"鸡蛋","unit":"个","quantity":2},{"name":"面粉","unit":"克","quantity":50},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["西葫芦擦成细丝，加盐腌5分钟","挤出西葫芦中多余水分","加入鸡蛋和面粉，搅拌均匀","平底锅烧热，刷少许油","舀入面糊，摊成小饼","中小火煎至两面金黄即可"]'::jsonb, '["早餐","饼类","快手菜","健康","蔬菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/zucchini_pancake.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('酸辣汤', '经典汤品，酸辣开胃，食材丰富', 'hot_and_sour_soup', '["午餐","晚餐"]'::jsonb, '中式', '汤羹', 15, 10, '简单', 120, '{"fat":5,"carbs":15,"fiber":3,"protein":8}'::jsonb, '[{"name":"豆腐","unit":"克","quantity":100},{"name":"木耳","unit":"克","quantity":30},{"name":"胡萝卜","unit":"根","quantity":0.5},{"name":"鸡蛋","unit":"个","quantity":1},{"name":"醋","unit":"毫升","quantity":20},{"name":"白胡椒粉","unit":"克","quantity":3},{"name":"淀粉","unit":"克","quantity":10},{"name":"盐","unit":"克","quantity":5}]'::jsonb, '["豆腐、木耳、胡萝卜切丝","锅中加水烧开，放入所有食材","煮5分钟后加醋、白胡椒粉和盐","水淀粉勾芡，缓缓倒入蛋液","轻轻搅拌形成蛋花即可"]'::jsonb, '["汤羹","酸辣","开胃","经典","快手菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/hot_and_sour_soup.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('鱼香肉丝', '经典川菜，鱼香味浓，肉丝嫩滑', 'yu_xiang_pork', '["午餐","晚餐"]'::jsonb, '川菜', '主菜', 15, 10, '中等', 260, '{"fat":15,"carbs":15,"fiber":3,"protein":25}'::jsonb, '[{"name":"猪里脊肉","unit":"克","quantity":300},{"name":"木耳","unit":"克","quantity":50},{"name":"胡萝卜","unit":"根","quantity":0.5},{"name":"青椒","unit":"个","quantity":1},{"name":"豆瓣酱","unit":"克","quantity":15},{"name":"糖","unit":"克","quantity":10},{"name":"醋","unit":"毫升","quantity":15},{"name":"生抽","unit":"毫升","quantity":10}]'::jsonb, '["猪肉切丝，用料酒、淀粉腌制","木耳、胡萝卜、青椒切丝","热锅凉油，滑炒肉丝至变色盛出","锅中留底油，炒香豆瓣酱","加入蔬菜丝翻炒","倒入肉丝，加糖醋汁翻炒均匀"]'::jsonb, '["川菜","经典","下饭菜","鱼香味","快手菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/yu_xiang_pork.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('南瓜粥', '香甜暖胃，营养早餐', 'pumpkin_porridge', '["早餐"]'::jsonb, '中式', '粥品', 10, 20, '简单', 150, '{"fat":2,"carbs":30,"fiber":5,"protein":4}'::jsonb, '[{"name":"南瓜","unit":"克","quantity":200},{"name":"大米","unit":"克","quantity":50},{"name":"水","unit":"毫升","quantity":800},{"name":"冰糖","unit":"克","quantity":15}]'::jsonb, '["大米洗净浸泡30分钟","南瓜去皮切小块","锅中加水和大米，大火烧开","加入南瓜块，转小火熬煮","煮至米烂南瓜熟，加入冰糖","继续煮5分钟至冰糖融化即可"]'::jsonb, '["早餐","粥品","暖胃","甜食","简单"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/pumpkin_porridge.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('羊肉汤', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('过油肉拌面', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('凉皮', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('酸辣土豆丝', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('红烧排骨', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('炒合菜', '多种蔬菜合炒，营养均衡', 'stir_fried_mixed_vegetables', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 15, 10, '简单', 150, '{"fat":8,"carbs":20,"fiber":8,"protein":6}'::jsonb, '[{"name":"豆芽","unit":"克","quantity":200},{"name":"韭菜","unit":"克","quantity":100},{"name":"胡萝卜","unit":"根","quantity":0.5},{"name":"木耳","unit":"克","quantity":50},{"name":"鸡蛋","unit":"个","quantity":2},{"name":"生抽","unit":"毫升","quantity":10},{"name":"盐","unit":"克","quantity":3}]'::jsonb, '["所有蔬菜洗净切好，木耳泡发","鸡蛋打散炒熟盛出","热锅凉油，先炒胡萝卜和木耳","加入豆芽快速翻炒","放入韭菜和炒好的鸡蛋","加生抽和盐调味，翻炒均匀"]'::jsonb, '["素菜","营养","快手菜","家常","低卡"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/stir_fried_mixed_vegetables.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('香豆花卷', 'null', NULL, '["breakfast"]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('海参鱿鱼', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('韭菜盒子', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('西红柿炒鸡蛋', '经典家常菜，酸甜开胃，营养丰富', 'tomato_scrambled_egg', '["午餐","晚餐"]'::jsonb, '中式', 'null', 10, 5, '简单', 280, '{}'::jsonb, '[{"name":"鸡蛋","unit":"个","quantity":2},{"name":"西红柿","unit":"个","quantity":2},{"name":"小葱","unit":"根","quantity":2},{"name":"盐","unit":"克","quantity":3},{"name":"糖","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["鸡蛋打入碗中，加少许盐打散","西红柿洗净切块，小葱切末","热锅凉油，倒入蛋液炒至凝固盛出","锅中再加油，放入西红柿翻炒至出汁","加入炒好的鸡蛋，加盐和糖调味","翻炒均匀，撒上葱花即可出锅"]'::jsonb, '["快手菜","下饭菜","家常","高蛋白","低成本","适合新手"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/tomato_scrambled_egg.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('炒空心菜', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('豆腐粉条包子', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('笋干肉包子', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('粉丝包菜', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('豆角正面', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('牛肉炒刀削', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('油泼面', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('疙瘩汤', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('凉拌三丝', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('油炸花生', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('老虎菜', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('丸子汤', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('大盘鸡', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('炖鸡汤', 'null', NULL, '[]'::jsonb, 'null', 'null', NULL, NULL, 'null', NULL, '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, NULL, NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('辣子鸡', '川味经典，麻辣干香，鸡肉酥脆', 'spicy_chicken', '["午餐","晚餐"]'::jsonb, '川菜', '主菜', 20, 15, '中等', 320, '{"fat":18,"carbs":15,"fiber":3,"protein":30}'::jsonb, '[{"name":"鸡腿肉","unit":"克","quantity":400},{"name":"干辣椒","unit":"克","quantity":50},{"name":"花椒","unit":"克","quantity":10},{"name":"葱","unit":"根","quantity":2},{"name":"姜","unit":"克","quantity":10},{"name":"料酒","unit":"毫升","quantity":15},{"name":"生抽","unit":"毫升","quantity":10}]'::jsonb, '["鸡腿肉切小块，用料酒、生抽腌制","干辣椒剪段，葱切段，姜切片","热锅多油，将鸡肉炸至金黄酥脆","锅中留底油，爆香干辣椒和花椒","加入葱姜炒香","倒入炸好的鸡肉翻炒均匀","最后撒上芝麻即可"]'::jsonb, '["川菜","辣","经典","下酒菜","重口味"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/spicy_chicken.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('香菇青菜', '家常素菜，营养均衡', 'mushroom_greens', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 10, 5, '简单', 100, '{"fat":6,"carbs":10,"fiber":4,"protein":5}'::jsonb, '[{"name":"上海青","unit":"克","quantity":300},{"name":"香菇","unit":"朵","quantity":6},{"name":"蒜","unit":"瓣","quantity":2},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":10}]'::jsonb, '["上海青洗净，香菇切片，蒜切片","烧一锅水，加少许盐和油","青菜焯烫30秒捞出沥干","热锅凉油，爆香蒜片","加入香菇片翻炒至软","放入青菜快速翻炒","加盐调味，翻炒均匀即可"]'::jsonb, '["素菜","家常","快手菜","清淡","营养"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/mushroom_greens.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('鱼香茄子', '鱼香味浓，茄子软糯', 'yu_xiang_eggplant', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 15, 10, '中等', 180, '{"fat":12,"carbs":20,"fiber":6,"protein":5}'::jsonb, '[{"name":"茄子","unit":"根","quantity":2},{"name":"猪肉末","unit":"克","quantity":100},{"name":"豆瓣酱","unit":"克","quantity":15},{"name":"醋","unit":"毫升","quantity":10},{"name":"糖","unit":"克","quantity":8},{"name":"生抽","unit":"毫升","quantity":10},{"name":"蒜","unit":"瓣","quantity":3},{"name":"姜","unit":"克","quantity":5}]'::jsonb, '["茄子切条，用盐水浸泡防止氧化","热锅多油，将茄子炸软捞出沥油","锅中留底油，炒香肉末","加入豆瓣酱、姜蒜末炒出红油","放入茄子翻炒均匀","加入糖、醋、生抽调成的鱼香汁","翻炒均匀，收汁即可"]'::jsonb, '["下饭菜","川菜","素菜可调","经典","中等难度"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/yu_xiang_eggplant.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('自制豆浆', '营养早餐，无添加更健康', 'homemade_soy_milk', '["早餐"]'::jsonb, '中式', '饮品', 8, 20, '简单', 120, '{"fat":5,"carbs":15,"fiber":2,"protein":10}'::jsonb, '[{"name":"黄豆","unit":"克","quantity":80},{"name":"水","unit":"毫升","quantity":1000},{"name":"白糖","unit":"克","quantity":15}]'::jsonb, '["黄豆提前浸泡8小时或过夜","泡好的黄豆洗净，放入豆浆机","加入适量水，选择豆浆程序","程序结束后过滤豆渣","根据口味加入白糖调味","热饮或冷藏后饮用均可"]'::jsonb, '["早餐","饮品","健康","自制","经典"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/homemade_soy_milk.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('紫菜蛋花汤', '简单快手，营养汤品', 'seaweed_egg_soup', '["午餐","晚餐"]'::jsonb, '中式', '汤羹', 3, 5, '简单', 70, '{"fat":4,"carbs":5,"fiber":2,"protein":5}'::jsonb, '[{"name":"紫菜","unit":"克","quantity":10},{"name":"鸡蛋","unit":"个","quantity":1},{"name":"虾皮","unit":"克","quantity":5},{"name":"香油","unit":"毫升","quantity":3},{"name":"盐","unit":"克","quantity":2},{"name":"葱花","unit":"克","quantity":5}]'::jsonb, '["紫菜用清水泡软洗净","鸡蛋打散备用","锅中加水烧开，放入紫菜和虾皮","煮2分钟后缓缓倒入蛋液","加盐调味，关火","淋香油，撒葱花即可"]'::jsonb, '["汤品","快手菜","简单","低卡","适合新手"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/seaweed_egg_soup.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('炒烤肉', '新疆特色，羊肉先烤后炒，香气浓郁', 'stir_fried_grilled_meat', '["午餐","晚餐"]'::jsonb, '新疆菜', '主菜', 20, 15, '中等', 320, '{"fat":20,"carbs":10,"fiber":3,"protein":35}'::jsonb, '[{"name":"羊肉","unit":"克","quantity":400},{"name":"洋葱","unit":"个","quantity":1},{"name":"孜然粉","unit":"克","quantity":10},{"name":"辣椒粉","unit":"克","quantity":5},{"name":"盐","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":20}]'::jsonb, '["羊肉切片，用盐、孜然粉腌制","烤箱200度烤10分钟或平底锅煎至表面焦黄","洋葱切丝","热锅凉油，炒香洋葱","加入烤好的羊肉翻炒","撒入辣椒粉和剩余孜然粉，炒匀出锅"]'::jsonb, '["新疆菜","羊肉","特色","下饭菜","香辣"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/stir_fried_grilled_meat.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('青椒肉丝', '经典川菜，麻辣鲜香，下饭神器', 'green_pepper_pork_strips', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 10, '中等', 320, '{"fat":20,"carbs":10,"fiber":3,"protein":25}'::jsonb, '[{"name":"猪里脊肉","unit":"克","quantity":200},{"name":"青椒","unit":"个","quantity":2},{"name":"红椒","unit":"个","quantity":1},{"name":"姜","unit":"克","quantity":10},{"name":"蒜","unit":"瓣","quantity":3},{"name":"生抽","unit":"毫升","quantity":15},{"name":"料酒","unit":"毫升","quantity":10},{"name":"淀粉","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":20}]'::jsonb, '["猪里脊肉切丝，加生抽、料酒、淀粉腌制10分钟","青椒、红椒去籽切丝，姜蒜切末","热锅凉油，下肉丝快速滑炒至变色盛出","锅中留底油，爆香姜蒜末","加入青红椒丝翻炒至断生","倒入肉丝，加适量盐和生抽调味","快速翻炒均匀即可出锅"]'::jsonb, '["下饭菜","川菜","快手菜","高蛋白","适合带饭"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/green_pepper_pork_strips.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('西兰花炒虾仁', '清淡爽口，高蛋白低脂肪', 'broccoli_shrimp_stir_fry', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 10, 8, '简单', 220, '{"fat":10,"carbs":8,"fiber":5,"protein":28}'::jsonb, '[{"name":"虾仁","unit":"克","quantity":200},{"name":"西兰花","unit":"克","quantity":300},{"name":"蒜","unit":"瓣","quantity":3},{"name":"姜","unit":"克","quantity":5},{"name":"盐","unit":"克","quantity":3},{"name":"料酒","unit":"毫升","quantity":10},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["虾仁用料酒和少许盐腌制10分钟","西兰花掰成小朵，用盐水浸泡后焯水1分钟","热锅凉油，爆香蒜片和姜丝","加入虾仁翻炒至变色","放入西兰花快速翻炒","加盐调味，翻炒均匀即可出锅"]'::jsonb, '["清淡","高蛋白","低脂","快手菜","健康"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/broccoli_shrimp_stir_fry.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('土豆炖牛肉', '营养丰富，肉质酥烂，适合全家人', 'potato_beef_stew', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 20, 60, '中等', 450, '{"fat":25,"carbs":30,"fiber":4,"protein":35}'::jsonb, '[{"name":"牛腩","unit":"克","quantity":500},{"name":"土豆","unit":"个","quantity":2},{"name":"胡萝卜","unit":"根","quantity":1},{"name":"洋葱","unit":"个","quantity":0.5},{"name":"姜","unit":"片","quantity":3},{"name":"八角","unit":"个","quantity":2},{"name":"生抽","unit":"毫升","quantity":30},{"name":"料酒","unit":"毫升","quantity":20},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["牛腩切块，冷水下锅焯水去血沫","热锅凉油，爆香姜片和八角","加入牛肉翻炒至表面微黄","加入料酒、生抽和足量热水","大火烧开转小火炖40分钟","加入土豆、胡萝卜、洋葱块","继续炖20分钟至食材软烂","加盐调味，大火收汁即可"]'::jsonb, '["炖菜","营养丰富","适合冬季","经典家常","耗时较长"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/potato_beef_stew.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('蒜蓉西兰花', '简单快手，健康低卡', 'garlic_broccoli', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 5, 5, '简单', 120, '{"fat":8,"carbs":10,"fiber":6,"protein":5}'::jsonb, '[{"name":"西兰花","unit":"克","quantity":400},{"name":"蒜","unit":"瓣","quantity":5},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":10}]'::jsonb, '["西兰花掰成小朵，用盐水浸泡10分钟","烧一锅水，加少许盐和油","西兰花焯水1-2分钟捞出","热锅凉油，爆香蒜末","加入西兰花快速翻炒","加盐调味，翻炒均匀即可"]'::jsonb, '["素菜","快手菜","低卡","健康","适合新手"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/garlic_broccoli.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('番茄鸡蛋汤', '简单快手，酸甜开胃', 'tomato_egg_soup', '["午餐","晚餐"]'::jsonb, '中式', '汤羹', 5, 8, '简单', 90, '{"fat":5,"carbs":8,"fiber":2,"protein":6}'::jsonb, '[{"name":"番茄","unit":"个","quantity":2},{"name":"鸡蛋","unit":"个","quantity":2},{"name":"小葱","unit":"根","quantity":1},{"name":"盐","unit":"克","quantity":3},{"name":"香油","unit":"毫升","quantity":3}]'::jsonb, '["番茄顶部划十字，用开水烫后去皮切块","鸡蛋打散备用，小葱切末","锅中加适量水烧开，放入番茄块","煮5分钟至番茄软烂","缓缓倒入蛋液，形成蛋花","加盐调味，淋香油，撒葱花即可"]'::jsonb, '["汤品","快手菜","家常","低卡","适合新手"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/tomato_egg_soup.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('蛋炒饭', '利用剩饭的经典做法', 'egg_fried_rice', '["午餐","晚餐"]'::jsonb, '中式', '主食', 5, 10, '简单', 350, '{"fat":15,"carbs":50,"fiber":2,"protein":12}'::jsonb, '[{"name":"隔夜米饭","unit":"克","quantity":300},{"name":"鸡蛋","unit":"个","quantity":2},{"name":"火腿肠","unit":"根","quantity":1},{"name":"葱花","unit":"克","quantity":10},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["鸡蛋打散，火腿肠切丁","热锅凉油，倒入蛋液炒散盛出","锅中再加少许油，放入米饭炒散","加入火腿丁翻炒均匀","倒入炒好的鸡蛋，加盐调味","撒上葱花，翻炒均匀即可出锅"]'::jsonb, '["主食","快手菜","剩饭利用","经典","简单"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/egg_fried_rice.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('凉拌黄瓜', '夏日开胃小菜，爽口解腻', 'cucumber_salad', '["午餐","晚餐"]'::jsonb, '中式', '凉菜', 10, NULL, '简单', 50, '{"fat":3,"carbs":8,"fiber":2,"protein":2}'::jsonb, '[{"name":"黄瓜","unit":"根","quantity":2},{"name":"蒜","unit":"瓣","quantity":3},{"name":"醋","unit":"毫升","quantity":15},{"name":"生抽","unit":"毫升","quantity":10},{"name":"香油","unit":"毫升","quantity":5},{"name":"白糖","unit":"克","quantity":5}]'::jsonb, '["黄瓜洗净，用刀拍裂切段","蒜切末，所有调料混合成酱汁","黄瓜放入碗中，倒入酱汁","拌匀后腌制10分钟更入味","装盘即可食用"]'::jsonb, '["凉菜","夏日","快手菜","低卡","开胃"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/cucumber_salad.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('番茄肉酱意大利面', '经典西餐，酸甜可口', 'spaghetti_bolognese', '["午餐","晚餐"]'::jsonb, '意式', '主食', 10, 20, '中等', 420, '{"fat":15,"carbs":60,"fiber":5,"protein":18}'::jsonb, '[{"name":"意大利面","unit":"克","quantity":100},{"name":"牛肉末","unit":"克","quantity":150},{"name":"番茄","unit":"个","quantity":2},{"name":"洋葱","unit":"个","quantity":0.5},{"name":"蒜","unit":"瓣","quantity":2},{"name":"番茄酱","unit":"毫升","quantity":30},{"name":"橄榄油","unit":"毫升","quantity":10},{"name":"盐","unit":"克","quantity":5}]'::jsonb, '["烧一锅水，加盐和橄榄油，煮意面8-10分钟","番茄去皮切丁，洋葱、蒜切末","热锅加橄榄油，炒香洋葱和蒜末","加入牛肉末炒至变色","放入番茄丁炒软，加番茄酱和适量水","小火炖煮15分钟成肉酱","煮好的意面与肉酱拌匀即可"]'::jsonb, '["西餐","主食","经典","适合约会","中等难度"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/spaghetti_bolognese.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('燕麦香蕉早餐杯', '免烤健康早餐，适合忙碌早晨', 'oat_banana_breakfast_cup', '["早餐"]'::jsonb, '西式', '早餐', 5, NULL, '简单', 250, '{"fat":8,"carbs":45,"fiber":8,"protein":10}'::jsonb, '[{"name":"燕麦片","unit":"克","quantity":50},{"name":"香蕉","unit":"根","quantity":1},{"name":"酸奶","unit":"克","quantity":100},{"name":"蜂蜜","unit":"毫升","quantity":10},{"name":"坚果","unit":"克","quantity":15}]'::jsonb, '["香蕉一半切片，一半捣成泥","杯中先铺一层燕麦片","加入香蕉泥，再铺一层酸奶","重复叠加至杯子装满","顶部用香蕉片和坚果装饰","淋上蜂蜜，冷藏一夜更美味"]'::jsonb, '["早餐","免烤","健康","快手","便携"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/oat_banana_breakfast_cup.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('清蒸鲈鱼', '原汁原味，鱼肉鲜嫩', 'steamed_bass', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 12, '中等', 180, '{"fat":8,"carbs":2,"fiber":1,"protein":30}'::jsonb, '[{"name":"鲈鱼","unit":"条（约500克）","quantity":1},{"name":"姜","unit":"克","quantity":20},{"name":"葱","unit":"根","quantity":2},{"name":"蒸鱼豉油","unit":"毫升","quantity":30},{"name":"食用油","unit":"毫升","quantity":15}]'::jsonb, '["鲈鱼清理干净，两面划几刀","鱼身内外抹少许盐，放姜片腌制10分钟","蒸锅水烧开，放入鲈鱼大火蒸8-10分钟","取出倒掉盘中多余水分","鱼身铺上葱丝，淋上热油","最后淋上蒸鱼豉油即可"]'::jsonb, '["海鲜","健康","清淡","宴客菜","中等难度"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/steamed_bass.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('混合蔬菜沙拉', '多种蔬菜组合，低卡健康', 'mixed_vegetable_salad', '["午餐","晚餐"]'::jsonb, '西式', '沙拉', 10, NULL, '简单', 120, '{"fat":8,"carbs":15,"fiber":6,"protein":4}'::jsonb, '[{"name":"生菜","unit":"克","quantity":100},{"name":"小番茄","unit":"个","quantity":10},{"name":"黄瓜","unit":"根","quantity":0.5},{"name":"紫甘蓝","unit":"克","quantity":50},{"name":"橄榄油","unit":"毫升","quantity":10},{"name":"柠檬汁","unit":"毫升","quantity":15},{"name":"盐","unit":"克","quantity":2},{"name":"黑胡椒粉","unit":"克","quantity":1}]'::jsonb, '["所有蔬菜洗净沥干水分","生菜撕成适口大小，黄瓜切片","小番茄对半切，紫甘蓝切丝","所有蔬菜放入沙拉碗中","橄榄油、柠檬汁、盐、黑胡椒调成油醋汁","淋在沙拉上，轻轻拌匀即可"]'::jsonb, '["沙拉","低卡","健康","素食","快手菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/mixed_vegetable_salad.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('可乐鸡翅', '香甜可口，孩子最爱', 'cola_chicken_wings', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 10, 20, '简单', 320, '{"fat":18,"carbs":20,"fiber":1,"protein":25}'::jsonb, '[{"name":"鸡翅中","unit":"个","quantity":8},{"name":"可乐","unit":"毫升","quantity":300},{"name":"姜","unit":"片","quantity":3},{"name":"生抽","unit":"毫升","quantity":20},{"name":"料酒","unit":"毫升","quantity":15},{"name":"食用油","unit":"毫升","quantity":10}]'::jsonb, '["鸡翅两面划刀，便于入味","冷水下锅焯水去血沫，捞出洗净","热锅凉油，煎鸡翅至两面金黄","加入姜片、料酒、生抽翻炒","倒入可乐没过鸡翅","大火烧开转小火炖15分钟","大火收汁至汤汁浓稠即可"]'::jsonb, '["甜口","家常","儿童喜爱","快手菜","经典"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/cola_chicken_wings.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('宫保鸡丁', '麻辣酸甜，经典川菜', 'kung_pao_chicken', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 10, '中等', 280, '{"fat":16,"carbs":15,"fiber":3,"protein":22}'::jsonb, '[{"name":"鸡胸肉","unit":"克","quantity":250},{"name":"花生米","unit":"克","quantity":50},{"name":"干辣椒","unit":"个","quantity":5},{"name":"花椒","unit":"克","quantity":1},{"name":"葱","unit":"根","quantity":2},{"name":"姜","unit":"克","quantity":10},{"name":"生抽","unit":"毫升","quantity":15},{"name":"醋","unit":"毫升","quantity":10},{"name":"白糖","unit":"克","quantity":10}]'::jsonb, '["鸡胸肉切丁，加料酒、淀粉腌制","干辣椒剪段，葱切段，姜蒜切末","热锅凉油，先炒香花生米盛出","锅中留油，爆香干辣椒和花椒","加入鸡丁滑炒至变色","加入葱姜蒜和调料汁翻炒","最后加入花生米炒匀即可"]'::jsonb, '["川菜","下饭菜","经典","麻辣","宴客菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/kung_pao_chicken.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('香煎三文鱼', '优质蛋白，富含Omega-3', 'pan_fried_salmon', '["午餐","晚餐"]'::jsonb, '西式', '主菜', 5, 8, '简单', 220, '{"fat":15,"carbs":2,"fiber":1,"protein":25}'::jsonb, '[{"name":"三文鱼排","unit":"克","quantity":200},{"name":"柠檬","unit":"个","quantity":0.5},{"name":"黑胡椒粉","unit":"克","quantity":2},{"name":"盐","unit":"克","quantity":2},{"name":"橄榄油","unit":"毫升","quantity":5}]'::jsonb, '["三文鱼用厨房纸吸干水分","两面撒上盐和黑胡椒粉","热锅加橄榄油，放入三文鱼","中火每面煎3-4分钟","煎至表面金黄，内部粉嫩","挤上柠檬汁即可食用"]'::jsonb, '["海鲜","高蛋白","健康","西式","快手菜"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/pan_fried_salmon.jpeg', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('丁丁炒面', '新疆特色炒面，面条切成丁状，口感独特', 'dingding_fried_noodles', '["午餐","晚餐"]'::jsonb, '中式', '主食', 20, 15, '中等', 450, '{"fat":15,"carbs":60,"fiber":5,"protein":18}'::jsonb, '[{"name":"面条","unit":"克","quantity":200},{"name":"牛肉","unit":"克","quantity":150},{"name":"青椒","unit":"个","quantity":1},{"name":"红椒","unit":"个","quantity":1},{"name":"洋葱","unit":"个","quantity":0.5},{"name":"番茄酱","unit":"毫升","quantity":30},{"name":"生抽","unit":"毫升","quantity":15},{"name":"食用油","unit":"毫升","quantity":20}]'::jsonb, '["面条煮熟后过冷水，切成小段","牛肉切丁，青红椒、洋葱切丁","热锅凉油，下牛肉丁炒至变色","加入蔬菜丁翻炒均匀","放入切好的面条，加番茄酱和生抽","快速翻炒均匀即可出锅"]'::jsonb, '["新疆菜","主食","特色","快手菜","面食"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/dingding_fried_noodles.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('干煸二节子', '新疆特色，香辣酥脆，口感独特', 'dry_fried_lamb_intestine', '["午餐","晚餐"]'::jsonb, '新疆菜', '主菜', 25, 20, '中等', 350, '{"fat":25,"carbs":15,"fiber":3,"protein":25}'::jsonb, '[{"name":"羊肠","unit":"克","quantity":400},{"name":"干辣椒","unit":"个","quantity":10},{"name":"花椒","unit":"克","quantity":5},{"name":"洋葱","unit":"个","quantity":1},{"name":"孜然粉","unit":"克","quantity":10},{"name":"盐","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":30}]'::jsonb, '["羊肠清洗干净，切段焯水","热锅多油，下羊肠煸炒至表面微焦","加入干辣椒、花椒炒出香味","放入洋葱丝继续翻炒","最后加孜然粉和盐调味","炒至干香即可出锅"]'::jsonb, '["新疆菜","特色","辣","下酒菜","独特口感"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/dry_fried_lamb_intestine.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('杏鲍菇牛肉粒', '杏鲍菇Q弹，牛肉鲜嫩，完美搭配', 'beef_and_oyster_mushroom_cubes', '["午餐","晚餐"]'::jsonb, '中式', '主菜', 15, 12, '中等', 290, '{"fat":18,"carbs":12,"fiber":5,"protein":28}'::jsonb, '[{"name":"牛肉","unit":"克","quantity":250},{"name":"杏鲍菇","unit":"个","quantity":2},{"name":"青椒","unit":"个","quantity":1},{"name":"红椒","unit":"个","quantity":1},{"name":"蚝油","unit":"毫升","quantity":15},{"name":"生抽","unit":"毫升","quantity":10},{"name":"黑胡椒粉","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":20}]'::jsonb, '["牛肉切粒，用生抽、黑胡椒粉腌制","杏鲍菇、青红椒切同样大小的粒","热锅凉油，先炒杏鲍菇至表面微黄盛出","锅中加油，炒牛肉粒至变色","加入青红椒粒和杏鲍菇翻炒","加蚝油调味，翻炒均匀出锅"]'::jsonb, '["菌菇","高蛋白","下饭菜","快手菜","营养"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/beef_and_oyster_mushroom_cubes.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('椒麻鸡', '川味凉菜，麻辣鲜香，鸡肉嫩滑', 'sichuan_pepper_chicken', '["午餐","晚餐"]'::jsonb, '川菜', '凉菜', 15, 25, '中等', 220, '{"fat":10,"carbs":5,"fiber":2,"protein":30}'::jsonb, '[{"name":"鸡腿","unit":"个","quantity":2},{"name":"花椒","unit":"克","quantity":10},{"name":"青花椒","unit":"克","quantity":5},{"name":"葱","unit":"根","quantity":2},{"name":"姜","unit":"克","quantity":20},{"name":"花椒油","unit":"毫升","quantity":15},{"name":"盐","unit":"克","quantity":5}]'::jsonb, '["鸡腿冷水下锅，加葱姜煮熟","煮熟的鸡腿放入冰水冷却","鸡肉撕成条，摆入盘中","花椒和青花椒用油煸香","花椒油过滤后加入盐调匀","椒麻油淋在鸡肉上即可"]'::jsonb, '["川菜","凉菜","麻辣","下酒菜","经典"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/sichuan_pepper_chicken.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('蒜蓉豆角', '豆角清脆，蒜香扑鼻，简单家常', 'garlic_string_beans', '["午餐","晚餐"]'::jsonb, '中式', '素菜', 10, 8, '简单', 110, '{"fat":6,"carbs":15,"fiber":6,"protein":4}'::jsonb, '[{"name":"豆角","unit":"克","quantity":300},{"name":"蒜","unit":"瓣","quantity":5},{"name":"盐","unit":"克","quantity":3},{"name":"食用油","unit":"毫升","quantity":10}]'::jsonb, '["豆角洗净，掐去两头，切段","蒜切末","烧一锅水，加少许盐和油","豆角焯烫3分钟至变色捞出","热锅凉油，爆香蒜末","放入豆角快速翻炒","加盐调味，翻炒均匀即可"]'::jsonb, '["素菜","家常","快手菜","蒜香","夏季"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/garlic_string_beans.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('酸汤肥牛', '酸辣开胃，肥牛嫩滑，金汤浓郁', 'sour_soup_fatty_beef', '["午餐","晚餐"]'::jsonb, '川菜', '主菜', 15, 10, '中等', 280, '{"fat":18,"carbs":10,"fiber":3,"protein":25}'::jsonb, '[{"name":"肥牛片","unit":"克","quantity":300},{"name":"金针菇","unit":"克","quantity":200},{"name":"黄灯笼辣椒酱","unit":"克","quantity":30},{"name":"白醋","unit":"毫升","quantity":20},{"name":"蒜","unit":"瓣","quantity":4},{"name":"姜","unit":"克","quantity":10},{"name":"青红椒","unit":"个","quantity":2}]'::jsonb, '["金针菇去根洗净，焯水铺在碗底","肥牛片焯水变色捞出","热锅凉油，炒香蒜姜末和黄灯笼酱","加水烧开，煮5分钟出味","放入肥牛煮1分钟","加白醋调味，倒入碗中","撒上青红椒圈，淋热油即可"]'::jsonb, '["川菜","酸辣","开胃","快手菜","冬季"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/sour_soup_fatty_beef.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('韭菜盒子', '北方传统面点，韭菜鸡蛋馅，外酥里嫩', 'chive_pancake', '["早餐","小吃"]'::jsonb, '中式', '面点', 25, 15, '中等', 250, '{"fat":10,"carbs":35,"fiber":5,"protein":8}'::jsonb, '[{"name":"面粉","unit":"克","quantity":300},{"name":"韭菜","unit":"克","quantity":200},{"name":"鸡蛋","unit":"个","quantity":3},{"name":"粉丝","unit":"克","quantity":50},{"name":"虾皮","unit":"克","quantity":20},{"name":"盐","unit":"克","quantity":5},{"name":"食用油","unit":"毫升","quantity":20}]'::jsonb, '["面粉加水和成面团，饧发30分钟","韭菜切碎，鸡蛋炒熟，粉丝泡软切碎","所有馅料混合，加盐和食用油调味","面团分成小剂子，擀成圆皮","包入馅料，捏成盒子形状","平底锅刷油，小火煎至两面金黄"]'::jsonb, '["北方菜","面点","传统","早餐","小吃"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/chive_pancake.png', NULL, NULL, NULL, FALSE, 0);

INSERT INTO recipes (name, description, english_name, meal_type, cuisine, category, prep_time, cook_time, difficulty, calories, macros, ingredients, instructions, tags, image_url, english_ingredients, english_instructions, user_id, is_published, save_count)
VALUES ('黄面烤肉', '新疆特色，黄面筋道，烤肉香浓', 'yellow_noodle_with_roast_meat', '["午餐","晚餐"]'::jsonb, '新疆菜', '主食', 20, 25, '中等', 420, '{"fat":15,"carbs":55,"fiber":4,"protein":25}'::jsonb, '[{"name":"黄面","unit":"克","quantity":200},{"name":"羊肉","unit":"克","quantity":250},{"name":"黄瓜","unit":"根","quantity":1},{"name":"番茄","unit":"个","quantity":1},{"name":"孜然粉","unit":"克","quantity":10},{"name":"辣椒粉","unit":"克","quantity":5},{"name":"盐","unit":"克","quantity":5},{"name":"醋","unit":"毫升","quantity":15}]'::jsonb, '["羊肉切片，用盐、孜然粉腌制","羊肉串串或平底锅煎烤至熟","黄面煮熟过凉水","黄瓜切丝，番茄切片","面条铺底，放上黄瓜番茄","摆上烤好的羊肉","撒辣椒粉，淋醋拌匀"]'::jsonb, '["新疆菜","特色","主食","烤肉","夏季"]'::jsonb, 'https://mckovksdjqghddoxjwoc.supabase.co/storage/v1/object/public/recipe_images/yellow_noodle_with_roast_meat.png', NULL, NULL, NULL, FALSE, 0);


-- =============================================
-- DONE! Verify the import:
-- =============================================
SELECT COUNT(*) as total_recipes FROM recipes;
