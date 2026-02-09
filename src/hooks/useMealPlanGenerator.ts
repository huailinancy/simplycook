import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SupabaseRecipe, RecipeSource, MealSlot, DAYS_OF_WEEK } from '@/types/recipe';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;

interface MealPlanGeneratorResult {
  weeklyPlan: MealSlot[];
  isGenerating: boolean;
  error: string | null;
}

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

  // Generate meal plan using ChatGPT
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

      // 2. Prepare recipe list for ChatGPT
      const recipeList = recipes.map(r => ({
        id: r.id,
        name: r.name,
        englishName: r.english_name,
        cuisine: r.cuisine,
        mealType: r.meal_type,
        category: r.category,
        calories: r.calories,
        prepTime: r.prep_time,
        cookTime: r.cook_time,
        tags: r.tags,
      }));

      // 3. Build the prompt
      const preferencesText = userPreferences ? `
User Preferences:
- Allergies to avoid: ${userPreferences.allergies?.join(', ') || 'None'}
- Diet preferences: ${userPreferences.dietPreferences?.join(', ') || 'None'}
- Flavor preferences: ${userPreferences.flavorPreferences?.join(', ') || 'None'}
` : '';

      const prompt = `You are a meal planning assistant. Generate a weekly meal plan (lunch and dinner) for 7 days using ONLY the recipes from the provided list.

Number of persons: ${numberOfPersons}
Dishes per meal: ${dishesPerMeal} (one dish per person)

${preferencesText}

Available Recipes:
${JSON.stringify(recipeList, null, 2)}

Requirements:
1. Select ${dishesPerMeal} different recipes for lunch and ${dishesPerMeal} different recipes for dinner for each day (Monday to Sunday)
2. Try to provide variety - avoid repeating the same recipe too often
3. Consider meal types when appropriate (e.g., lighter meals for lunch)
4. If user has allergies, avoid recipes that might contain those allergens based on name/tags
5. Prefer recipes matching user's diet and flavor preferences
6. For each meal, select dishes that complement each other well

Return ONLY a valid JSON array with exactly ${totalSlots} meal slots in this format:
[
  {"dayOfWeek": 0, "mealType": "lunch", "recipeId": <recipe_id>},
  {"dayOfWeek": 0, "mealType": "lunch", "recipeId": <recipe_id>},
  {"dayOfWeek": 0, "mealType": "dinner", "recipeId": <recipe_id>},
  {"dayOfWeek": 0, "mealType": "dinner", "recipeId": <recipe_id>},
  {"dayOfWeek": 1, "mealType": "lunch", "recipeId": <recipe_id>},
  ...
]

Where dayOfWeek is 0 for Monday through 6 for Sunday. Each day should have ${dishesPerMeal} lunch entries and ${dishesPerMeal} dinner entries.
Return ONLY the JSON array, no other text.`;

      // 4. Call ChatGPT API
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a helpful meal planning assistant. Always respond with valid JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.7,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to generate meal plan');
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;

      if (!content) {
        throw new Error('No response from AI');
      }

      // 5. Parse the response
      let mealPlanData: { dayOfWeek: number; mealType: 'lunch' | 'dinner'; recipeId: number }[];
      try {
        // Clean the response - remove markdown code blocks if present
        const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        mealPlanData = JSON.parse(cleanContent);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        throw new Error('Failed to parse meal plan. Please try again.');
      }

      // 6. Map recipe IDs to actual recipe objects
      const recipeMap = new Map(recipes.map(r => [r.id, r]));

      const mealSlots: MealSlot[] = mealPlanData.map(item => ({
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
