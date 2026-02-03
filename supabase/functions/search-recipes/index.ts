import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SpoonacularRecipe {
  id: number;
  title: string;
  image: string;
  imageType: string;
  servings: number;
  readyInMinutes: number;
  sourceUrl: string;
  sourceName?: string;
  cuisines: string[];
  dishTypes: string[];
  diets: string[];
  nutrition?: {
    nutrients: Array<{
      name: string;
      amount: number;
      unit: string;
    }>;
    ingredients: Array<{
      id: number;
      name: string;
      amount: number;
      unit: string;
    }>;
  };
}

interface SearchParams {
  query?: string;
  cuisine?: string;
  type?: string; // meal type: main course, dessert, etc.
  diet?: string;
  maxReadyTime?: number;
  number?: number;
  offset?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const SPOONACULAR_API_KEY = Deno.env.get('SPOONACULAR_API_KEY');
    
    if (!SPOONACULAR_API_KEY) {
      console.error('SPOONACULAR_API_KEY is not configured');
      return new Response(
        JSON.stringify({ error: 'API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const params: SearchParams = {
      query: url.searchParams.get('query') || '',
      cuisine: url.searchParams.get('cuisine') || undefined,
      type: url.searchParams.get('type') || undefined,
      diet: url.searchParams.get('diet') || undefined,
      maxReadyTime: url.searchParams.get('maxReadyTime') 
        ? parseInt(url.searchParams.get('maxReadyTime')!) 
        : undefined,
      number: parseInt(url.searchParams.get('number') || '12'),
      offset: parseInt(url.searchParams.get('offset') || '0'),
    };

    console.log('Search params:', params);

    // Build Spoonacular API URL
    const spoonacularUrl = new URL('https://api.spoonacular.com/recipes/complexSearch');
    spoonacularUrl.searchParams.set('apiKey', SPOONACULAR_API_KEY);
    spoonacularUrl.searchParams.set('addRecipeNutrition', 'true');
    spoonacularUrl.searchParams.set('addRecipeInformation', 'true');
    spoonacularUrl.searchParams.set('fillIngredients', 'true');
    spoonacularUrl.searchParams.set('number', params.number?.toString() || '12');
    spoonacularUrl.searchParams.set('offset', params.offset?.toString() || '0');

    if (params.query) {
      spoonacularUrl.searchParams.set('query', params.query);
    }
    if (params.cuisine) {
      spoonacularUrl.searchParams.set('cuisine', params.cuisine);
    }
    if (params.type) {
      spoonacularUrl.searchParams.set('type', params.type);
    }
    if (params.diet) {
      spoonacularUrl.searchParams.set('diet', params.diet);
    }
    if (params.maxReadyTime) {
      spoonacularUrl.searchParams.set('maxReadyTime', params.maxReadyTime.toString());
    }

    console.log('Fetching from Spoonacular:', spoonacularUrl.toString().replace(SPOONACULAR_API_KEY, '***'));

    const response = await fetch(spoonacularUrl.toString());
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Spoonacular API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to fetch recipes from Spoonacular',
          details: errorText,
          status: response.status 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    console.log(`Found ${data.results?.length || 0} recipes, total: ${data.totalResults}`);

    // Transform Spoonacular response to our Recipe format
    const recipes = (data.results || []).map((recipe: SpoonacularRecipe) => {
      const calories = recipe.nutrition?.nutrients?.find(n => n.name === 'Calories');
      
      return {
        uri: recipe.id.toString(),
        label: recipe.title,
        image: recipe.image,
        source: recipe.sourceName || 'Spoonacular',
        url: recipe.sourceUrl,
        yield: recipe.servings,
        dietLabels: recipe.diets || [],
        healthLabels: [],
        cautions: [],
        ingredientLines: recipe.nutrition?.ingredients?.map(i => 
          `${i.amount} ${i.unit} ${i.name}`
        ) || [],
        ingredients: recipe.nutrition?.ingredients?.map(i => ({
          text: `${i.amount} ${i.unit} ${i.name}`,
          quantity: i.amount,
          measure: i.unit,
          food: i.name,
          weight: 0,
          foodCategory: '',
          foodId: i.id.toString(),
          image: '',
        })) || [],
        calories: calories?.amount || 0,
        totalWeight: 0,
        totalTime: recipe.readyInMinutes,
        cuisineType: recipe.cuisines || [],
        mealType: [],
        dishType: recipe.dishTypes || [],
        totalNutrients: Object.fromEntries(
          (recipe.nutrition?.nutrients || []).map(n => [
            n.name,
            { label: n.name, quantity: n.amount, unit: n.unit }
          ])
        ),
        totalDaily: {},
      };
    });

    return new Response(
      JSON.stringify({ 
        recipes,
        totalResults: data.totalResults,
        offset: data.offset,
        number: data.number,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in search-recipes function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
