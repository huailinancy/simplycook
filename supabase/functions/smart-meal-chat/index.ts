import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

    const { messages, currentPlan, recipes, weekRange } = await req.json();

    // Build compact recipe catalogue for the LLM
    const recipeLines = (recipes as any[])
      .map((r: any) => {
        const name = r.english_name ? `${r.name} / ${r.english_name}` : r.name;
        const meals = Array.isArray(r.meal_type) ? r.meal_type.join(',') : (r.meal_type || 'lunch,dinner');
        return `[${r.id}] ${name} | ${r.cuisine || 'Other'} | ${meals}`;
      })
      .join('\n');

    const systemPrompt = `You are a smart meal planning assistant for SimplyCook.
You can both answer questions about the current meal plan AND generate new meal plans based on the user's request.

IMPORTANT: You MUST always respond with ONLY valid JSON — no markdown, no explanation outside the JSON.

Use this format for Q&A (when no plan change is needed):
{"reply": "your answer", "action": null}

Use this format when generating or modifying the meal plan:
{"reply": "friendly confirmation summarising what you planned", "action": {"type": "FILL_SLOTS", "slots": [{"dayOfWeek": 0, "mealType": "lunch", "recipeId": 123}, ...]}}

Slot assignment rules:
- dayOfWeek: 0=Monday 1=Tuesday 2=Wednesday 3=Thursday 4=Friday 5=Saturday 6=Sunday
- mealType: "lunch" or "dinner"
- Generate exactly 14 slots (one lunch + one dinner for every day of the week)
- Only use recipeIds that appear in the Available Recipes list below
- Honour the user's cuisine/diet/category requests strictly
- If the user says "X days [Cuisine A] and Y days [Cuisine B]", assign Cuisine A to days 0..X-1 and Cuisine B to days X..X+Y-1
- Avoid repeating the same recipe more than twice per week
- If a requested cuisine has too few recipes, pick the closest alternatives and mention it in the reply

Current week: ${weekRange}

Current meal plan:
${currentPlan || '(no meals planned yet)'}

Available Recipes (format: [id] name | cuisine | meal types):
${recipeLines || '(no recipes available — tell the user to add recipes first)'}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        temperature: 0.4,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message ?? `Groq error ${response.status}`);
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? '{}';

    let parsed: { reply: string; action: any };
    try {
      parsed = JSON.parse(raw);
      if (!parsed.reply) parsed.reply = 'Done!';
    } catch {
      parsed = { reply: raw, action: null };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('smart-meal-chat error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
