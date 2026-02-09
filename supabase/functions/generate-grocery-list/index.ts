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
    const { recipeNames, language } = await req.json();

    if (!OPENAI_API_KEY) {
      throw new Error('OpenAI API key not configured');
    }

    const isEnglish = language === 'en';

    const prompt = isEnglish
      ? `You are a helpful grocery shopping assistant. Based on these recipe names, generate a comprehensive grocery shopping list in English.

Recipes to prepare:
${recipeNames.join('\n')}

Group ingredients by category (Proteins, Vegetables, Seasonings & Sauces, Staples, etc.).
Combine similar ingredients and estimate reasonable quantities for a week of meals.
Format as a simple list with categories.

Return ONLY the grocery list, no other text.`
      : `你是一个购物助手。根据以下菜谱名称，生成一份完整的购物清单。

需要准备的菜谱：
${recipeNames.join('\n')}

请按类别分组（肉类、蔬菜、调味料、主食等）。
合并相似的食材，估算一周所需的合理数量。
以简单的清单格式输出。

只返回购物清单，不要其他文字。`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: isEnglish
            ? 'You are a helpful grocery shopping assistant. Always respond in English.'
            : '你是一个购物助手。请用中文回复。'
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to generate grocery list');
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No response from AI');
    }

    return new Response(JSON.stringify({ groceryList: content }), {
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
