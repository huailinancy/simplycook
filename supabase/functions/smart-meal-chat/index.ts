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

    const { messages, currentPlan, availableCuisines, weekRange } = await req.json();

    const systemPrompt = `You are a smart meal planning assistant for SimplyCook.
You MUST always respond with ONLY valid JSON — no markdown, no text outside the JSON.

═══════════════════════════════════════════════
RESPONSE FORMAT A — answering a factual question:
{"reply": "your answer", "action": null}

RESPONSE FORMAT B — generating or changing the meal plan:
{
  "reply": "friendly confirmation of what you planned",
  "action": {
    "type": "GENERATE_PLAN",
    "assignments": [
      {"dayOfWeek": 0, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 1, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 2, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 3, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 4, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 5, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"},
      {"dayOfWeek": 6, "lunch": "<cuisine or 'any'>", "dinner": "<cuisine or 'any'>"}
    ],
    "maxCalories": <number or null>,
    "requiredTags": []
  }
}
═══════════════════════════════════════════════

CRITICAL — use FORMAT B whenever the user:
• asks to generate, create, build, suggest, make, or plan meals
• mentions specific cuisines for days (e.g. "4 days Chinese and 3 days Italian")
• mentions dietary preferences: "low-calorie", "healthy", "vegetarian", "high-protein", "light"
• says "I want [type of] meals", "give me a [type] plan", "plan my week"
• asks to change or redo the meal plan

FORMAT B rules:
- assignments MUST contain exactly 7 entries (dayOfWeek 0 through 6)
- dayOfWeek: 0=Monday 1=Tuesday 2=Wednesday 3=Thursday 4=Friday 5=Saturday 6=Sunday
- cuisine values: use names from the Available Cuisines list, OR use "any" for no preference
- "X days [Cuisine A] and Y days [Cuisine B]" → Cuisine A for days 0..X-1, Cuisine B for days X..X+Y-1
- If no cuisine specified, use "any" for all days
- maxCalories: set a number for calorie-restricted requests:
    "low-calorie" / "light" → 450
    "medium-calorie" / "balanced" → 600
    no calorie preference → null
- requiredTags: array of tag strings to require (e.g. ["vegetarian"]), usually []

ONLY use FORMAT A for purely factual questions about the CURRENT plan
(e.g. "What's on Monday?", "How many calories total?", "What's for dinner Thursday?").

Current week: ${weekRange}

Current meal plan:
${currentPlan || '(no meals planned yet)'}

Available Cuisines in the recipe database:
${(availableCuisines as string[]).join(', ')}`;

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
        temperature: 0.2,
        max_tokens: 900,
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
