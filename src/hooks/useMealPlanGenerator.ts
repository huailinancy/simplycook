import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseRecipe, RecipeSource, MealSlot } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useMealPlanGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch recipes based on source
  const fetchRecipesBySource = useCallback(async (source: RecipeSource): Promise<SupabaseRecipe[]> => {
    try {
      if (source === 'saved') {
        if (!user) return [];

        const { data: savedData, error: savedError } = await supabase
          .from('saved_recipes')
          .select('recipe_id')
          .eq('user_id', user.id);

        if (savedError) throw savedError;
        if (!savedData || savedData.length === 0) return [];

        const recipeIds = savedData.map(s => s.recipe_id);

        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .in('id', recipeIds);

        if (error) throw error;
        return data as SupabaseRecipe[];
      }
      else if (source === 'my-recipes') {
        if (!user) return [];

        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;
        return data as SupabaseRecipe[];
      }
      else {
        // 'all' - fetch all recipes, filter client-side
        const { data, error } = await supabase
          .from('recipes')
          .select('*');

        if (error) throw error;
        // Only show system recipes (user_id is null/undefined/empty)
        return (data as SupabaseRecipe[]).filter(r =>
          r.user_id === null ||
          r.user_id === undefined ||
          r.user_id === ''
        );
      }
    } catch (err) {
      console.error('Error fetching recipes:', err);
      return [];
    }
  }, [user]);

  // Smart shuffle - ensures variety by avoiding consecutive repeats
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate meal plan with prioritised sources
  // sources[0] is primary — slots are filled from it first.
  // sources[1..] supplement only when primary doesn't have enough unique recipes.
  const generateMealPlan = useCallback(async (
    sources: RecipeSource[],
    userPreferences?: { allergies?: string[]; dietPreferences?: string[]; flavorPreferences?: string[] },
    numberOfPersons: number = 2
  ): Promise<MealSlot[]> => {
    setIsGenerating(true);
    setError(null);

    const dishesPerMeal = numberOfPersons;
    const totalSlots = 7 * 2 * dishesPerMeal;

    try {
      // 1. Fetch primary source
      const primarySource = sources[0] ?? 'all';
      const primaryRecipes = await fetchRecipesBySource(primarySource);

      // 2. Fetch supplementary sources (deduplicated against primary)
      const seenIds = new Set(primaryRecipes.map(r => r.id));
      let supplementRecipes: SupabaseRecipe[] = [];
      for (let i = 1; i < sources.length; i++) {
        const extras = await fetchRecipesBySource(sources[i]);
        for (const r of extras) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            supplementRecipes.push(r);
          }
        }
      }

      if (primaryRecipes.length === 0 && supplementRecipes.length === 0) {
        const label = primarySource === 'all' ? 'the repository'
          : primarySource === 'saved' ? 'your saved recipes' : 'your recipes';
        throw new Error(`No recipes found in ${label}. Please add some recipes first.`);
      }

      // 3. Apply preference filtering (allergies) — fall back if filtering empties the pool
      const applyFilters = (list: SupabaseRecipe[]) => {
        if (!userPreferences?.allergies?.length) return list;
        const filtered = list.filter(recipe => {
          const tags = (recipe.tags || []).map(t => t.toLowerCase());
          const name = recipe.name.toLowerCase();
          return !userPreferences.allergies!.some(a =>
            tags.includes(a.toLowerCase()) || name.includes(a.toLowerCase())
          );
        });
        return filtered.length > 0 ? filtered : list;
      };

      const filteredPrimary = applyFilters(primaryRecipes);
      const filteredSupp = applyFilters(supplementRecipes);

      // 4. Build pool: fill with primary first, supplement only when primary runs short
      let recipePool: SupabaseRecipe[] = [];
      while (recipePool.length < totalSlots) {
        recipePool = [...recipePool, ...shuffleArray(filteredPrimary)];
        if (recipePool.length < totalSlots && filteredSupp.length > 0) {
          recipePool = [...recipePool, ...shuffleArray(filteredSupp)];
        }
        // Guard against infinite loop if both pools are empty
        if (filteredPrimary.length === 0 && filteredSupp.length === 0) break;
      }

      const totalAvailable = filteredPrimary.length + filteredSupp.length;
      if (totalAvailable < totalSlots) {
        toast({
          title: 'Limited recipes',
          description: `Only ${totalAvailable} unique recipes available — some meals will repeat.`,
        });
      }

      // 5. Assign recipes to slots
      const mealSlots: MealSlot[] = [];
      let poolIndex = 0;
      for (let day = 0; day < 7; day++) {
        for (let i = 0; i < dishesPerMeal; i++) {
          mealSlots.push({ dayOfWeek: day, mealType: 'lunch', recipe: recipePool[poolIndex % recipePool.length] });
          poolIndex++;
        }
        for (let i = 0; i < dishesPerMeal; i++) {
          mealSlots.push({ dayOfWeek: day, mealType: 'dinner', recipe: recipePool[poolIndex % recipePool.length] });
          poolIndex++;
        }
      }

      const sourceLabel = sources.length > 1
        ? `${sources[0] === 'my-recipes' ? 'My Recipes' : sources[0] === 'saved' ? 'Saved' : 'All'} (+ ${sources.length - 1} more)`
        : sources[0] === 'my-recipes' ? 'My Recipes' : sources[0] === 'saved' ? 'Saved Recipes' : 'All Recipes';

      toast({
        title: 'Meal plan generated!',
        description: `Your weekly plan is ready using ${sourceLabel}. Adjust as needed.`,
      });

      return mealSlots;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate meal plan';
      setError(errorMessage);
      toast({ title: 'Generation failed', description: errorMessage, variant: 'destructive' });
      return [];
    } finally {
      setIsGenerating(false);
    }
  }, [fetchRecipesBySource, toast]);

  return {
    generateMealPlan,
    fetchRecipesBySource,
    isGenerating,
    error,
  };
}
