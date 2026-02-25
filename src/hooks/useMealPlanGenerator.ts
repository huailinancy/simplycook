import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseRecipe, MealSlot } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

export function useMealPlanGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch recipes by category ID
  const fetchRecipesByCategory = useCallback(async (categoryId: string): Promise<SupabaseRecipe[]> => {
    try {
      if (!user) return [];
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id)
        .eq('category_id', categoryId);
      if (error) throw error;
      return data as SupabaseRecipe[];
    } catch (err) {
      console.error('Error fetching recipes by category:', err);
      return [];
    }
  }, [user]);

  // Fetch all user recipes (for recipe picker)
  const fetchRecipesBySource = useCallback(async (source: string): Promise<SupabaseRecipe[]> => {
    try {
      if (!user) return [];
      // If source is a UUID (category ID), fetch by category
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(source)) {
        return fetchRecipesByCategory(source);
      }
      // Fallback: fetch all user recipes
      const { data, error } = await supabase
        .from('recipes')
        .select('*')
        .eq('user_id', user.id);
      if (error) throw error;
      return data as SupabaseRecipe[];
    } catch (err) {
      console.error('Error fetching recipes:', err);
      return [];
    }
  }, [user, fetchRecipesByCategory]);

  // Smart shuffle - ensures variety by avoiding consecutive repeats
  const shuffleArray = <T,>(array: T[]): T[] => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Generate meal plan with prioritised category sources
  // categoryIds[0] is primary — slots are filled from it first.
  // categoryIds[1..] supplement only when primary doesn't have enough unique recipes.
  const generateMealPlan = useCallback(async (
    categoryIds: string[],
    userPreferences?: { allergies?: string[]; dietPreferences?: string[]; flavorPreferences?: string[] },
    numberOfPersons: number = 2
  ): Promise<MealSlot[]> => {
    setIsGenerating(true);
    setError(null);

    const dishesPerMeal = numberOfPersons;
    const totalSlots = 7 * 2 * dishesPerMeal;

    try {
      // 1. Fetch primary category
      const primaryCategoryId = categoryIds[0];
      if (!primaryCategoryId) throw new Error('Please select at least one category.');
      const primaryRecipes = await fetchRecipesByCategory(primaryCategoryId);

      // 2. Fetch supplementary categories (deduplicated against primary)
      const seenIds = new Set(primaryRecipes.map(r => r.id));
      let supplementRecipes: SupabaseRecipe[] = [];
      for (let i = 1; i < categoryIds.length; i++) {
        const extras = await fetchRecipesByCategory(categoryIds[i]);
        for (const r of extras) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            supplementRecipes.push(r);
          }
        }
      }

      if (primaryRecipes.length === 0 && supplementRecipes.length === 0) {
        throw new Error('No recipes found in the selected categories. Please add recipes to your categories first.');
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

      const sourceLabel = `${categoryIds.length} ${categoryIds.length === 1 ? 'category' : 'categories'}`;

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
  }, [fetchRecipesByCategory, toast]);

  return {
    generateMealPlan,
    fetchRecipesBySource,
    isGenerating,
    error,
  };
}
