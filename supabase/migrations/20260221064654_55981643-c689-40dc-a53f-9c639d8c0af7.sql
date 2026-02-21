-- Drop the existing restrictive SELECT policies and recreate as permissive
DROP POLICY IF EXISTS "Anyone can view system recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON public.recipes;

-- Recreate as PERMISSIVE (default) — any matching policy grants access
CREATE POLICY "Anyone can view system recipes"
ON public.recipes FOR SELECT
USING (user_id IS NULL);

CREATE POLICY "Anyone can view published recipes"
ON public.recipes FOR SELECT
USING (is_published = true);

CREATE POLICY "Users can view own recipes"
ON public.recipes FOR SELECT
USING (auth.uid() = user_id);