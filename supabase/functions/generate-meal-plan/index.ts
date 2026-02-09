import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipes, preferences, numberOfPersons } = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const dishesPerMeal = numberOfPersons || 2;
    const totalSlots = 7 * 2 * dishesPerMeal;

    const recipeList = recipes.map((r: any) => ({
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

    const preferencesText = preferences ? `
User Preferences:
- Allergies to avoid: ${preferences.allergies?.join(', ') || 'None'}
- Diet preferences: ${preferences.dietPreferences?.join(', ') || 'None'}
- Flavor preferences: ${preferences.flavorPreferences?.join(', ') || 'None'}
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
        max_tokens: 2000,
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

    // Clean and parse the response
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const mealPlanData = JSON.parse(cleanContent);

    return new Response(JSON.stringify({ mealPlan: mealPlanData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
