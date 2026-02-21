import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Pull plain text + image URLs out of raw HTML */
function extractFromHtml(html: string): { text: string; ogImage: string | null; imageUrls: string[] } {
  // og:image (main thumbnail)
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  const ogImage = ogMatch?.[1] ?? null;

  const seen = new Set<string>();
  const imageUrls: string[] = [];

  const addImg = (u: string) => {
    if (!u || seen.has(u)) return;
    // skip obvious non-content images
    if (/favicon|logo|icon|avatar|profile|badge|button/i.test(u)) return;
    // only real image extensions or CDN patterns
    if (!/\.(jpg|jpeg|png|webp)/i.test(u) && !/\/img\//i.test(u)) return;
    seen.add(u);
    imageUrls.push(u);
  };

  if (ogImage) addImg(ogImage);

  // Image URLs embedded in JS/JSON inside <script> tags (XHS stores all post images here)
  const scriptContent = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .join('\n');
  for (const m of scriptContent.matchAll(/"(https?:\/\/[^"]{10,}\.(jpg|jpeg|png|webp)[^"]*?)"/gi)) {
    addImg(m[1]);
  }

  // <img src=...>
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    addImg(m[1]);
  }

  // Strip tags for plain text
  let text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
    .replace(/\s+/g, ' ').trim();

  return {
    text: text.slice(0, 5000),
    ogImage,
    imageUrls: imageUrls.slice(0, 8), // cap at 8 images
  };
}

/** Download an image server-side and return a base64 data-URI.
 *  This bypasses hotlink protection that would block Groq's servers. */
async function fetchImageAsDataUri(imageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.xiaohongshu.com/',
        'Accept': 'image/webp,image/jpeg,image/*',
      },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > 4 * 1024 * 1024) return null; // skip >4 MB
    const bytes = new Uint8Array(buf);
    let binary = '';
    // Build binary string in chunks to avoid stack overflow
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Ask Groq vision to read all text visible in one image */
async function readTextFromImage(dataUri: string): Promise<string> {
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [{
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: dataUri } },
            {
              type: 'text',
              text: 'This is a cooking recipe photo. Extract ALL text visible in this image — ingredient names, quantities, step numbers, cooking instructions, times, temperatures, and any other text. Output only the extracted text, nothing else.',
            },
          ],
        }],
        temperature: 0.1,
        max_tokens: 500,
      }),
    });
    if (!res.ok) return '';
    const data = await res.json();
    return data.choices?.[0]?.message?.content ?? '';
  } catch {
    return '';
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    // 1. Fetch the page
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!pageRes.ok) throw new Error(`Failed to fetch URL: ${pageRes.status} ${pageRes.statusText}`);

    const html = await pageRes.text();
    const { text: pageText, ogImage, imageUrls } = extractFromHtml(html);

    console.log(`Page text length: ${pageText.length}, images found: ${imageUrls.length}`);

    // 2. Download images and run vision OCR concurrently
    let imageTexts: string[] = [];
    if (imageUrls.length > 0) {
      const dataUris = await Promise.all(imageUrls.map(fetchImageAsDataUri));
      const ocrResults = await Promise.all(
        dataUris.map(uri => (uri ? readTextFromImage(uri) : Promise.resolve('')))
      );
      imageTexts = ocrResults.filter(t => t.trim().length > 10);
      console.log(`Got OCR text from ${imageTexts.length} images`);
    }

    // 3. Combine everything
    const combinedContent = [
      pageText.length > 50 ? `=== Page text ===\n${pageText}` : '',
      imageTexts.length > 0
        ? `=== Text extracted from recipe images ===\n${imageTexts.map((t, i) => `[Image ${i + 1}]\n${t}`).join('\n\n')}`
        : '',
    ].filter(Boolean).join('\n\n');

    if (!combinedContent.trim()) throw new Error('Could not extract any content from the URL');

    // 4. Ask text model to structure into recipe JSON
    const cuisineList = '川菜, 粤菜, 湘菜, 家常菜, Chinese, Sichuan, Cantonese, Home-style, Japanese, Korean, Thai, Italian, Other';
    const mealTypeList = '早餐, 午餐, 晚餐, 小吃, 甜点, breakfast, lunch, dinner, snack, dessert';

    const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              'You are a recipe extraction assistant. Given web page text and/or text extracted from recipe images, produce a structured recipe. Return ONLY valid JSON — no markdown, no extra text.',
          },
          {
            role: 'user',
            content: `Extract the recipe and return ONLY this JSON (use null for missing fields):
{
  "name": "recipe name in English",
  "description": "1-2 sentence description in English",
  "cuisine": "one of: ${cuisineList}",
  "meal_type": "one of: ${mealTypeList}",
  "prep_time": <integer minutes or null>,
  "cook_time": <integer minutes or null>,
  "difficulty": "easy | medium | hard",
  "calories": <integer per serving or null>,
  "ingredients": [{"name": "ingredient", "amount": "quantity + unit"}],
  "instructions": ["Step 1: ...", "Step 2: ...", ...],
  "tags": ["tag1", "tag2"],
  "image_url": ${ogImage ? `"${ogImage}"` : 'null'}
}

Content:
${combinedContent.slice(0, 9000)}`,
          },
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
    const raw = groqData.choices?.[0]?.message?.content ?? '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const recipe = JSON.parse(clean);

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
