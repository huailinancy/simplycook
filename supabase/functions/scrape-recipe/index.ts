import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function extractTextAndImage(html: string): { text: string; imageUrl: string | null } {
  // Extract og:image
  const ogImageMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const imageUrl = ogImageMatch?.[1] ?? null;

  // Remove script and style blocks
  let text = html.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ');
  text = text.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Remove all remaining tags
  text = text.replace(/<[^>]+>/g, ' ');
  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
  // Collapse whitespace and limit length
  text = text.replace(/\s+/g, ' ').trim().slice(0, 8000);

  return { text, imageUrl };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY is not configured');
    }

    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    // Fetch the page, following redirects, with a mobile UA to get cleaner HTML
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!pageRes.ok) {
      throw new Error(`Failed to fetch URL: ${pageRes.status} ${pageRes.statusText}`);
    }

    const html = await pageRes.text();
    const { text: pageText, imageUrl: ogImage } = extractTextAndImage(html);

    if (!pageText || pageText.length < 20) {
      throw new Error('Page content is empty or too short to parse');
    }

    const cuisineList = '川菜, 粤菜, 湘菜, 鲁菜, 苏菜, 浙菜, 家常菜, Chinese, Sichuan, Cantonese, Home-style, Other';
    const mealTypeList = '早餐, 午餐, 晚餐, 小吃, 甜点, breakfast, lunch, dinner, snack';

    const systemPrompt = `You are a recipe extraction assistant. Extract recipe information from web page text (may be Chinese or English). Return ONLY valid JSON, no markdown, no explanation.`;

    const userPrompt = `Extract recipe data from this web page text. Return ONLY this JSON structure (use null for any field you cannot determine):

{
  "name": "recipe name (translate to English if Chinese)",
  "description": "brief description (1-2 sentences, in English)",
  "cuisine": "one of: ${cuisineList}",
  "meal_type": "one of: ${mealTypeList}",
  "prep_time": <number of minutes or null>,
  "cook_time": <number of minutes or null>,
  "difficulty": "easy | medium | hard",
  "calories": <number per serving or null>,
  "ingredients": [{"name": "ingredient name", "amount": "quantity and unit"}],
  "instructions": ["step 1 text", "step 2 text"],
  "tags": ["tag1", "tag2"],
  "image_url": ${ogImage ? `"${ogImage}"` : 'null'}
}

Page text:
${pageText}`;

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    if (!groqRes.ok) {
      const err = await groqRes.json();
      throw new Error(err?.error?.message ?? `Groq error ${groqRes.status}`);
    }

    const groqData = await groqRes.json();
    const content = groqData.choices?.[0]?.message?.content ?? '';

    // Strip any markdown code fences
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recipe = JSON.parse(cleanContent);

    return new Response(JSON.stringify({ recipe }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('scrape-recipe error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
