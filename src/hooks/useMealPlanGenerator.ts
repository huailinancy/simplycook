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

        // Get saved recipe IDs first
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
        // 'all' - fetch all available recipes (system + published)
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .or('user_id.is.null,is_published.eq.true');

        if (error) throw error;
        return data as SupabaseRecipe[];
      }
    } catch (err) {
      console.error('Error fetching recipes:', err);
      return [];
    }
  }, [user]);

  // Generate meal plan using Supabase Edge Function
  const generateMealPlan = useCallback(async (
    source: RecipeSource,
    userPreferences?: { allergies?: string[]; dietPreferences?: string[]; flavorPreferences?: string[] },
    numberOfPersons: number = 2
  ): Promise<MealSlot[]> => {
    setIsGenerating(true);
    setError(null);

    // Number of dishes per meal equals number of persons
    const dishesPerMeal = numberOfPersons;
    const totalSlots = 7 * 2 * dishesPerMeal; // 7 days * 2 meals * dishes per meal

    try {
      // 1. Fetch available recipes
      const recipes = await fetchRecipesBySource(source);

      if (recipes.length === 0) {
        throw new Error(`No recipes found in ${source === 'all' ? 'the repository' : source === 'saved' ? 'your saved recipes' : 'your recipes'}. Please add some recipes first.`);
      }

      if (recipes.length < totalSlots) {
        toast({
          title: 'Limited recipes',
          description: `Only ${recipes.length} recipes available. Some meals may be repeated.`,
        });
      }

      // 2. Call Supabase Edge Function
      const { data, error: fnError } = await supabase.functions.invoke('generate-meal-plan', {
        body: {
          recipes: recipes,
          preferences: userPreferences,
          numberOfPersons: numberOfPersons,
        },
      });

      if (fnError) {
        throw new Error(fnError.message || 'Failed to generate meal plan');
      }

      if (data.error) {
        throw new Error(data.error);
      }

      const mealPlanData = data.mealPlan;

      // 3. Map recipe IDs to actual recipe objects
      const recipeMap = new Map(recipes.map(r => [r.id, r]));

      const mealSlots: MealSlot[] = mealPlanData.map((item: { dayOfWeek: number; mealType: 'lunch' | 'dinner'; recipeId: number }) => ({
        dayOfWeek: item.dayOfWeek,
        mealType: item.mealType,
        recipe: recipeMap.get(item.recipeId) || null,
      }));

      // Validate we have all required slots (7 days * 2 meals * dishesPerMeal)
      const validSlots = mealSlots.filter(slot => slot.recipe !== null);
      if (validSlots.length < totalSlots) {
        // Fill missing slots with random recipes
        const allDays = [0, 1, 2, 3, 4, 5, 6];
        const allMealTypes: ('lunch' | 'dinner')[] = ['lunch', 'dinner'];

        for (const day of allDays) {
          for (const mealType of allMealTypes) {
            // Count existing dishes for this day/meal
            const existingCount = mealSlots.filter(
              s => s.dayOfWeek === day && s.mealType === mealType && s.recipe
            ).length;

            // Add missing dishes
            for (let i = existingCount; i < dishesPerMeal; i++) {
              const randomRecipe = recipes[Math.floor(Math.random() * recipes.length)];
              mealSlots.push({
                dayOfWeek: day,
                mealType,
                recipe: randomRecipe,
              });
            }
          }
        }
      }

      toast({
        title: 'Meal plan generated!',
        description: 'Your weekly meal plan is ready. You can adjust it as needed.',
      });

      return mealSlots.filter(s => s.recipe !== null);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate meal plan';
      setError(errorMessage);
      toast({
        title: 'Generation failed',
        description: errorMessage,
        variant: 'destructive',
      });
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
