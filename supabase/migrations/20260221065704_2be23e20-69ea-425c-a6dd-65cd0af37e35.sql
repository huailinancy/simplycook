
-- Drop existing restrictive SELECT policies on recipes
DROP POLICY IF EXISTS "Anyone can view system recipes" ON public.recipes;
DROP POLICY IF EXISTS "Anyone can view published recipes" ON public.recipes;
DROP POLICY IF EXISTS "Users can view own recipes" ON public.recipes;

-- Recreate as PERMISSIVE (the default)
CREATE POLICY "Anyone can view system recipes"
ON public.recipes AS PERMISSIVE FOR SELECT
TO public
USING (user_id IS NULL);

CREATE POLICY "Anyone can view published recipes"
ON public.recipes AS PERMISSIVE FOR SELECT
TO public
USING (is_published = true);

CREATE POLICY "Users can view own recipes"
ON public.recipes AS PERMISSIVE FOR SELECT
TO authenticated
USING (auth.uid() = user_id);
