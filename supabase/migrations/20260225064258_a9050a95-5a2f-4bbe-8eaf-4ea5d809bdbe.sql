
-- Create recipe_categories table
CREATE TABLE public.recipe_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recipe_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categories" ON public.recipe_categories FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own categories" ON public.recipe_categories FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categories" ON public.recipe_categories FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categories" ON public.recipe_categories FOR DELETE USING (auth.uid() = user_id);

-- Add category_id to recipes table
ALTER TABLE public.recipes ADD COLUMN category_id UUID REFERENCES public.recipe_categories(id) ON DELETE SET NULL;
