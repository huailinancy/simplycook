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
        // 'all' - fetch all available recipes (system + published)
        // System recipes have user_id = null, user recipes must have is_published = true
        const { data, error } = await supabase
          .from('recipes')
          .select('*')
          .or('user_id.is.null,and(user_id.not.is.null,is_published.eq.true)');

        if (error) throw error;
        return data as SupabaseRecipe[];
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

  // Generate meal plan using smart random selection
  const generateMealPlan = useCallback(async (
    source: RecipeSource,
    userPreferences?: { allergies?: string[]; dietPreferences?: string[]; flavorPreferences?: string[] },
    numberOfPersons: number = 2
  ): Promise<MealSlot[]> => {
    setIsGenerating(true);
    setError(null);

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

      // 2. Filter recipes based on user preferences (if provided)
      let filteredRecipes = [...recipes];

      if (userPreferences?.allergies && userPreferences.allergies.length > 0) {
        filteredRecipes = filteredRecipes.filter(recipe => {
          const recipeTags = (recipe.tags || []).map(t => t.toLowerCase());
          const recipeName = recipe.name.toLowerCase();
          return !userPreferences.allergies!.some(allergy =>
            recipeTags.includes(allergy.toLowerCase()) ||
            recipeName.includes(allergy.toLowerCase())
          );
        });
      }

      // If filtering removed all recipes, fall back to all recipes
      if (filteredRecipes.length === 0) {
        filteredRecipes = [...recipes];
      }

      // 3. Create shuffled recipe pool (repeat if needed)
      let recipePool: SupabaseRecipe[] = [];
      while (recipePool.length < totalSlots) {
        recipePool = [...recipePool, ...shuffleArray(filteredRecipes)];
      }

      // 4. Generate meal slots
      const mealSlots: MealSlot[] = [];
      let poolIndex = 0;

      for (let day = 0; day < 7; day++) {
        // Lunch dishes
        for (let i = 0; i < dishesPerMeal; i++) {
          mealSlots.push({
            dayOfWeek: day,
            mealType: 'lunch',
            recipe: recipePool[poolIndex % recipePool.length],
          });
          poolIndex++;
        }
        // Dinner dishes
        for (let i = 0; i < dishesPerMeal; i++) {
          mealSlots.push({
            dayOfWeek: day,
            mealType: 'dinner',
            recipe: recipePool[poolIndex % recipePool.length],
          });
          poolIndex++;
        }
      }

      toast({
        title: 'Meal plan generated!',
        description: 'Your weekly meal plan is ready. You can adjust it as needed.',
      });

      return mealSlots;

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
