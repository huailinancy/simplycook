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
You can answer questions about the current meal plan AND generate new weekly meal plans.

ALWAYS respond with ONLY valid JSON — no markdown, no text outside the JSON.

───────────────────────────────────────────────
FORMAT A — answering a question (no plan change):
{"reply": "your answer here", "action": null}

FORMAT B — generating or changing the meal plan:
{"reply": "friendly summary of what you planned", "action": {"type": "GENERATE_BY_CUISINE", "assignments": [
  {"dayOfWeek": 0, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 1, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 2, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 3, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 4, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 5, "lunch": "<cuisine>", "dinner": "<cuisine>"},
  {"dayOfWeek": 6, "lunch": "<cuisine>", "dinner": "<cuisine>"}
]}}
───────────────────────────────────────────────

Rules for FORMAT B:
- dayOfWeek: 0=Monday 1=Tuesday 2=Wednesday 3=Thursday 4=Friday 5=Saturday 6=Sunday
- You MUST include all 7 days (dayOfWeek 0 through 6) in the assignments array
- Use ONLY cuisine names from the Available Cuisines list below
- "X days [Cuisine A] and Y days [Cuisine B]" → assign Cuisine A to days 0..X-1, Cuisine B to days X..X+Y-1
- If a cuisine isn't in the list, pick the closest available alternative and mention it in the reply
- lunch and dinner can have different cuisines if the user asks

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
        temperature: 0.3,
        max_tokens: 800,
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
