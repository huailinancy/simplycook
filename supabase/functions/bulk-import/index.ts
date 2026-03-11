import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Extract image URLs from raw HTML, including XHS CDN URLs without file extensions */
function extractImageUrls(html: string): string[] {
  const seen = new Set<string>();
  const imageUrls: string[] = [];

  const addImg = (u: string) => {
    if (!u || seen.has(u)) return;
    if (/favicon|logo|icon|avatar|profile|badge|button|watermark/i.test(u)) return;
    const hasImageExt = /\.(jpg|jpeg|png|webp)/i.test(u);
    const isXhsCdn = /xhscdn\.com|xiaohongshu\.com/i.test(u);
    if (!hasImageExt && !isXhsCdn && !/\/img\//i.test(u)) return;
    seen.add(u);
    imageUrls.push(u);
  };

  // og:image
  const ogMatch =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) addImg(ogMatch[1]);

  // Image URLs embedded in JS/JSON script tags
  const scriptContent = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .join('\n');

  // URLs with standard image extensions
  for (const m of scriptContent.matchAll(/"(https?:\/\/[^"]{10,}\.(jpg|jpeg|png|webp)[^"]*?)"/gi)) {
    addImg(m[1]);
  }

  // XHS CDN URLs without extensions (e.g. sns-img-hw.xhscdn.com/spectrum/...)
  for (const m of scriptContent.matchAll(/"(https?:\/\/[^"]*xhscdn\.com\/[^"]{15,})"/gi)) {
    addImg(m[1]);
  }

  // Also check imageList / url patterns common in XHS __INITIAL_STATE__
  for (const m of scriptContent.matchAll(/"url"\s*:\s*"(https?:\/\/[^"]{15,})"/gi)) {
    addImg(m[1]);
  }

  // <img src=...>
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    addImg(m[1]);
  }

  return imageUrls;
}

/** Download an image server-side and return a base64 data-URI plus raw bytes */
async function fetchImageAsDataUri(imageUrl: string): Promise<{ dataUri: string; bytes: Uint8Array; contentType: string } | null> {
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
    if (buf.byteLength > 4 * 1024 * 1024) return null;
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    const contentType = res.headers.get('content-type') ?? 'image/jpeg';
    return { dataUri: `data:${contentType};base64,${b64}`, bytes, contentType };
  } catch {
    return null;
  }
}

/** Upload raw image bytes to Supabase Storage and return the public URL */
async function uploadToStorage(bytes: Uint8Array, contentType: string, idx: number): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';
    const path = `bulk-import/${Date.now()}-${idx}.${ext}`;
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/recipe-images/${path}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'false',
      },
      body: bytes as unknown as BodyInit,
    });
    if (!res.ok) return null;
    return `${SUPABASE_URL}/storage/v1/object/public/recipe-images/${path}`;
  } catch {
    return null;
  }
}

const CUISINE_LIST = '川菜, 粤菜, 湘菜, 家常菜, Chinese, Sichuan, Cantonese, Home-style, Japanese, Korean, Thai, Italian, Other';
const MEAL_TYPE_LIST = '早餐, 午餐, 晚餐, 小吃, 甜点, breakfast, lunch, dinner, snack, dessert';

/** Use vision model to extract a complete recipe JSON from one image */
async function extractRecipeFromImage(dataUri: string, imgUrl: string): Promise<object | null> {
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
              text: `This is a recipe photo or recipe card image. Extract the complete recipe from it and return ONLY valid JSON (no markdown fences, no extra text):
{
  "name": "recipe name in English",
  "description": "1-2 sentence description in English",
  "cuisine": "one of: ${CUISINE_LIST}",
  "meal_type": "one of: ${MEAL_TYPE_LIST}",
  "prep_time": <integer minutes or null>,
  "cook_time": <integer minutes or null>,
  "difficulty": "easy | medium | hard",
  "calories": <integer per serving or null>,
  "ingredients": [{"name": "ingredient name", "amount": "quantity + unit"}],
  "instructions": ["Step 1: ...", "Step 2: ...", ...],
  "tags": ["tag1", "tag2"],
  "image_url": "${imgUrl}"
}`,
            },
          ],
        }],
        temperature: 0.1,
        max_tokens: 1200,
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const raw = data.choices?.[0]?.message?.content ?? '';
    const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    return JSON.parse(clean);
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    if (!GROQ_API_KEY) throw new Error('GROQ_API_KEY is not configured');

    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    // 1. Fetch page HTML
    const pageRes = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,*/*;q=0.9',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      },
      redirect: 'follow',
    });

    if (!pageRes.ok) throw new Error(`Failed to fetch page: ${pageRes.status}`);
    const html = await pageRes.text();
    const imageUrls = extractImageUrls(html);

    console.log(`Found ${imageUrls.length} images on page`);

    // Cap at 10 images
    const toProcess = imageUrls.slice(0, 10);
    if (toProcess.length === 0) throw new Error('No images found on the page');

    // 2. Process in batches of 4 to respect rate limits
    const recipes: object[] = [];
    const BATCH_SIZE = 4;

    for (let i = 0; i < toProcess.length; i += BATCH_SIZE) {
      const batch = toProcess.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(batch.map(async (imgUrl, j) => {
        const result = await fetchImageAsDataUri(imgUrl);
        if (!result) return null;
        const { dataUri, bytes, contentType } = result;

        // Upload to Supabase Storage for a permanent URL
        const storageUrl = await uploadToStorage(bytes, contentType, i + j);
        const persistentUrl = storageUrl ?? imgUrl;

        return extractRecipeFromImage(dataUri, persistentUrl);
      }));

      for (const r of batchResults) {
        if (r) recipes.push(r);
      }
    }

    console.log(`Extracted ${recipes.length} recipes`);

    return new Response(JSON.stringify({ recipes, total: imageUrls.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('bulk-import error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
