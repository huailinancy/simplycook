import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/** Check if a URL is from Xiaohongshu (XHS) */
function isXhsUrl(url: string): boolean {
  return /xhslink\.com|xiaohongshu\.com/i.test(url);
}

/** Extract video URL from XHS HTML */
function extractXhsVideoUrl(html: string): string | null {
  // Try og:video meta tag first
  const ogVideoMatch = html.match(/<meta[^>]+property=[\"']og:video[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:video[\"']/i);
  if (ogVideoMatch) return ogVideoMatch[1];

  // Try og:video:url
  const ogVideoUrlMatch = html.match(/<meta[^>]+property=[\"']og:video:url[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:video:url[\"']/i);
  if (ogVideoUrlMatch) return ogVideoUrlMatch[1];

  // Try extracting video URL from __INITIAL_STATE__
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (stateMatch) {
    const stateStr = stateMatch[1];
    
    // Look for video stream URLs in various XHS JSON patterns
    // Pattern: \"originVideoKey\":\"xxx\" or \"url\":\"https://...sns-video...mp4...\"
    const videoPatterns = [
      /\"(?:masterUrl|url|originVideoH264Url|originVideoH265Url)\"\s*:\s*\"(https?:\/\/[^\"]*(?:sns-video|xhscdn\.com\/video|\.mp4)[^\"]*?)\"/gi,
      /\"(?:stream|video)(?:Url|_url|URL)\"\s*:\s*\"(https?:\/\/[^\"]*?)\"/gi,
    ];
    
    for (const pattern of videoPatterns) {
      for (const m of stateStr.matchAll(pattern)) {
        const url = m[1].replace(/\\u002F/g, '/').replace(/\\\\\//g, '/');
        if (url.includes('video') || url.includes('.mp4') || url.includes('.m3u8')) {
          return url;
        }
      }
    }

    // Try to find any sns-video CDN URL
    const snsVideoMatch = stateStr.match(/\"(https?:\/\/sns-video[^\"]+)\"/);
    if (snsVideoMatch) return snsVideoMatch[1].replace(/\\u002F/g, '/').replace(/\\\\\//g, '/');
  }

  // Also check for video source tags in HTML
  const videoSrcMatch = html.match(/<video[^>]*>[\s\S]*?<source[^>]+src=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<video[^>]+src=[\"']([^\"']+)[\"']/i);
  if (videoSrcMatch) return videoSrcMatch[1];

  return null;
}

/** Check if this is a video post (XHS type=video or has video content) */
function isVideoPost(html: string, url: string): boolean {
  if (/type=video/i.test(url)) return true;
  if (html.match(/<meta[^>]+property=[\"']og:type[\"'][^>]+content=[\"']video/i)) return true;
  if (html.match(/<meta[^>]+content=[\"']video[^\"']*[\"'][^>]+property=[\"']og:type[\"']/i)) return true;
  // Check __INITIAL_STATE__ for video type
  if (html.match(/\"type\"\s*:\s*\"video\"/i)) return true;
  return false;
}

/** Download video and return as base64 data URI. Limited to ~10MB to stay within edge function limits. */
async function fetchVideoAsBase64(videoUrl: string): Promise<{ dataUri: string; mimeType: string } | null> {
  try {
    console.log(`Downloading video: ${videoUrl.slice(0, 120)}...`);
    const res = await fetch(videoUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': 'https://www.xiaohongshu.com/',
        'Accept': 'video/mp4,video/*,*/*',
      },
      redirect: 'follow',
    });

    if (!res.ok) {
      console.error(`Video download failed: ${res.status}`);
      return null;
    }

    const contentLength = parseInt(res.headers.get('content-length') || '0');
    console.log(`Video response: ${res.status}, content-type: ${res.headers.get('content-type')}, size: ${contentLength}`);
    
    // Skip if too large (>10MB)
    if (contentLength > 10 * 1024 * 1024) {
      console.log('Video too large, skipping download');
      return null;
    }

    const buf = await res.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) {
      console.log(`Video buffer too large: ${buf.byteLength}`);
      return null;
    }

    console.log(`Video downloaded: ${buf.byteLength} bytes`);
    const bytes = new Uint8Array(buf);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    const b64 = btoa(binary);
    const mimeType = res.headers.get('content-type') || 'video/mp4';
    return { dataUri: `data:${mimeType};base64,${b64}`, mimeType };
  } catch (e) {
    console.error('Video download error:', e);
    return null;
  }
}

/** Use Gemini to transcribe video and extract recipe */
async function transcribeVideoAndExtract(
  videoBase64: { dataUri: string; mimeType: string },
  pageText: string,
  ogImage: string | null
): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY not configured');

  const cuisineList = '川菜, 粤菜, 湘菜, 家常菜, 东北菜, Chinese, Sichuan, Cantonese, Home-style, Japanese, Korean, Thai, Italian, Other';
  const mealTypeList = '早餐, 午餐, 晚餐, 小吃, 甜点, breakfast, lunch, dinner, snack, dessert';

  const jsonTemplate = `{
  \"name\": \"recipe name (keep original language if Chinese)\",
  \"description\": \"1-2 sentence description\",
  \"cuisine\": \"one of: ${cuisineList}\",
  \"meal_type\": \"one of: ${mealTypeList}\",
  \"prep_time\": <integer minutes or null>,
  \"cook_time\": <integer minutes or null>,
  \"difficulty\": \"easy | medium | hard\",
  \"calories\": <integer per serving or null>,
  \"ingredients\": [{\"name\": \"ingredient\", \"amount\": \"quantity + unit\"}],
  \"instructions\": [\"Step 1: ...\", \"Step 2: ...\", ...],
  \"tags\": [\"tag1\", \"tag2\"],
  \"image_url\": ${ogImage ? `\"${ogImage}\"` : 'null'}
}`;

  console.log('Sending video to Gemini for transcription + recipe extraction...');

  const contentParts: any[] = [
    {
      type: 'image_url',
      image_url: { url: videoBase64.dataUri },
    },
    {
      type: 'text',
      text: `This is a cooking recipe video. Please:
1. Watch/listen to the entire video carefully
2. Transcribe all spoken content (the narrator explains ingredients and cooking steps)
3. Also note any text overlays shown in the video
4. Extract the complete recipe with precise ingredient amounts and step-by-step instructions

${pageText.length > 20 ? `Additional context from the page:\n${pageText}\n\n` : ''}Return ONLY valid JSON (no markdown fences):
${jsonTemplate}`,
    },
  ];

  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [{
        role: 'user',
        content: contentParts,
      }],
      temperature: 0.1,
      max_tokens: 3000,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Gemini video transcription error: ${res.status} ${errText.slice(0, 300)}`);
    throw new Error(`Video transcription failed: ${res.status}`);
  }

  const data = await res.json();
  const raw = data.choices?.[0]?.message?.content ?? '';
  console.log(`Gemini video response length: ${raw.length}`);
  const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  return JSON.parse(clean);
}

/** Extract XHS note data from __INITIAL_STATE__ or embedded JSON in HTML */
function extractXhsData(html: string): { title: string; desc: string; imageUrls: string[]; author: string } | null {
  // Try to find __INITIAL_STATE__ 
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  
  let title = '';
  let desc = '';
  let author = '';
  const imageUrls: string[] = [];

  // Extract title from og:title or <title>
  const ogTitleMatch = html.match(/<meta[^>]+(?:property|name)=[\"']og:title[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']og:title[\"']/i);
  if (ogTitleMatch) title = ogTitleMatch[1];

  if (!title) {
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) title = titleMatch[1].replace(/ - 小红书$/, '').trim();
  }

  const ogDescMatch = html.match(/<meta[^>]+(?:property|name)=[\"']og:description[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']og:description[\"']/i);
  if (ogDescMatch) desc = ogDescMatch[1];

  const authorMatch = html.match(/<meta[^>]+(?:property|name)=[\"'](?:og:)?author[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"'](?:og:)?author[\"']/i)
    ?? html.match(/<meta[^>]+name=[\"']author[\"'][^>]+content=[\"']([^\"']+)[\"']/i);
  if (authorMatch) author = authorMatch[1];

  const ogImgMatch = html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i)
    ?? html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i);
  if (ogImgMatch) imageUrls.push(ogImgMatch[1]);

  const seen = new Set<string>(imageUrls);
  const isContentImage = (u: string) => !/(avatar|\/w\/\d{2,3}\/|badge|icon|logo)/i.test(u);
  
  for (const m of html.matchAll(/(https?:\/\/(?:sns-webpic-qc\.xhscdn\.com|ci\.xiaohongshu\.com|sns-img-[a-z]+\.xhscdn\.com)[^\s\"'\\)]+)/gi)) {
    const url = m[1].replace(/\\u002F/g, '/');
    if (!seen.has(url) && isContentImage(url)) {
      seen.add(url);
      imageUrls.push(url);
    }
  }

  for (const m of html.matchAll(/\"(https?:\/\/[^\"]*xhscdn\.com[^\"]*\.(jpg|jpeg|png|webp)[^\"]*?)\"/gi)) {
    const url = m[1].replace(/\\u002F/g, '/');
    if (!seen.has(url) && isContentImage(url)) {
      seen.add(url);
      imageUrls.push(url);
    }
  }

  if (stateMatch) {
    try {
      const stateStr = stateMatch[1];
      const descRegex = /\"desc\"\s*:\s*\"([^\"]{5,})\"/g;
      for (const dm of stateStr.matchAll(descRegex)) {
        const decoded = dm[1].replace(/\\n/g, '\n').replace(/\\u[\dA-Fa-f]{4}/g, (m: string) =>
          String.fromCharCode(parseInt(m.slice(2), 16))
        );
        if (decoded.length > desc.length) {
          desc = decoded;
        }
      }
      const titleRegex = new RegExp('\"title\"\\s*:\\s*\"([^\"]{2,})\"');
      const titleFromState = stateStr.match(titleRegex);
      if (titleFromState && !title) {
        title = titleFromState[1].replace(/\\u[\dA-Fa-f]{4}/g, (m: string) =>
          String.fromCharCode(parseInt(m.slice(2), 16))
        );
      }
      if (!author) {
        const nicknameRegex = new RegExp('\"nickname\"\\s*:\\s*\"([^\"]{1,})\"');
        const nicknameFromState = stateStr.match(nicknameRegex);
        if (nicknameFromState) {
          author = nicknameFromState[1].replace(/\\u[\dA-Fa-f]{4}/g, (m: string) =>
            String.fromCharCode(parseInt(m.slice(2), 16))
          );
        }
      }
      const urlRegex = new RegExp('\"url\"\\s*:\\s*\"(https?://[^\"]*xhscdn\\.com[^\"]*?)\"', 'gi');
      for (const m of stateStr.matchAll(urlRegex)) {
        const u = m[1].replace(/\\u002F/g, '/');
        if (!seen.has(u) && isContentImage(u)) {
          seen.add(u);
          imageUrls.push(u);
        }
      }
    } catch { /* ignore parse errors */ }
  }

  const uniqueImages: string[] = [];
  const baseSeen = new Set<string>();
  for (const url of imageUrls) {
    const base = url.split('?')[0].split('!')[0];
    if (!baseSeen.has(base)) {
      baseSeen.add(base);
      uniqueImages.push(url);
    }
  }

  if (!title && !desc && uniqueImages.length === 0) return null;
  return { title, desc, imageUrls: uniqueImages.slice(0, 8), author };
}

/** Pull plain text + image URLs out of raw HTML */
function extractFromHtml(html: string): { text: string; ogImage: string | null; imageUrls: string[] } {
  const ogMatch =
    html.match(/<meta[^>]+property=[\"']og:image[\"'][^>]+content=[\"']([^\"']+)[\"']/i) ??
    html.match(/<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+property=[\"']og:image[\"']/i);
  const ogImage = ogMatch?.[1] ?? null;

  const seen = new Set<string>();
  const imageUrls: string[] = [];

  const addImg = (u: string) => {
    if (!u || seen.has(u)) return;
    if (/favicon|logo|icon|avatar|profile|badge|button/i.test(u)) return;
    if (!/\.(jpg|jpeg|png|webp)/i.test(u) && !/\/img\//i.test(u) && !/xhscdn\.com/i.test(u)) return;
    seen.add(u);
    imageUrls.push(u);
  };

  if (ogImage) addImg(ogImage);

  const scriptContent = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(m => m[1])
    .join('\n');
  for (const m of scriptContent.matchAll(/\"(https?:\/\/[^\"{10,}\.(jpg|jpeg|png|webp)[^\"]*?)\"/gi)) {
    addImg(m[1]);
  }

  for (const m of html.matchAll(/<img[^>]+src=[\"']([^\"']+)[\"']/gi)) {
    addImg(m[1]);
  }

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
    imageUrls: imageUrls.slice(0, 8),
  };
}

/** Download an image server-side and return a base64 data-URI. */
async function fetchImageAsDataUri(imageUrl: string, referer?: string): Promise<string | null> {
  try {
    console.log(`Fetching image: ${imageUrl.slice(0, 100)}...`);
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15',
        'Referer': referer || 'https://www.xiaohongshu.com/',
        'Accept': 'image/webp,image/jpeg,image/*',
      },
      redirect: 'follow',
    });
    console.log(`Image response: ${res.status} ${res.headers.get('content-type')} size=${res.headers.get('content-length')}`);
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
    const ct = res.headers.get('content-type') ?? 'image/jpeg';
    return `data:${ct};base64,${b64}`;
  } catch {
    return null;
  }
}

/** Use Lovable AI gateway (Gemini) to extract recipe — supports vision with image URLs */
async function extractRecipeWithVision(pageText: string, imageDataUris: string[], ogImage: string | null): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');

  const cuisineList = '川菜, 粤菜, 湘菜, 家常菜, 东北菜, Chinese, Sichuan, Cantonese, Home-style, Japanese, Korean, Thai, Italian, Other';
  const mealTypeList = '早餐, 午餐, 晚餐, 小吃, 甜点, breakfast, lunch, dinner, snack, dessert';

  const jsonTemplate = `{
  \"name\": \"recipe name (keep original language if Chinese)\",
  \"description\": \"1-2 sentence description\",
  \"cuisine\": \"one of: ${cuisineList}\",
  \"meal_type\": \"one of: ${mealTypeList}\",
  \"prep_time\": <integer minutes or null>,
  \"cook_time\": <integer minutes or null>,
  \"difficulty\": \"easy | medium | hard\",
  \"calories\": <integer per serving or null>,
  \"ingredients\": [{\"name\": \"ingredient\", \"amount\": \"quantity + unit\"}],
  \"instructions\": [\"Step 1: ...\", \"Step 2: ...\", ...],
  \"tags\": [\"tag1\", \"tag2\"],
  \"image_url\": ${ogImage ? `\"${ogImage}\"` : 'null'}
}`;

  if (LOVABLE_API_KEY && imageDataUris.length > 0) {
    try {
      console.log(`Sending ${imageDataUris.length} images to Gemini vision`);
      const contentParts: any[] = [];
      
      for (const dataUri of imageDataUris) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: dataUri },
        });
      }
      
      contentParts.push({
        type: 'text',
        text: `You are a recipe extraction assistant. Look at these recipe images carefully and combine with any text below to extract the complete recipe.

${pageText.length > 20 ? `Page text:\n${pageText}\n\n` : ''}Return ONLY valid JSON (no markdown fences):
${jsonTemplate}`,
      });

      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{
            role: 'user',
            content: contentParts,
          }],
          temperature: 0.1,
          max_tokens: 2000,
        }),
      });
      
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content ?? '';
        console.log(`Gemini vision response length: ${raw.length}`);
        const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean);
      } else {
        const errText = await res.text();
        console.error(`Gemini vision error: ${res.status} ${errText.slice(0, 200)}`);
      }
    } catch (e) {
      console.error('Gemini vision failed:', e);
    }
  }

  const textPrompt = `Extract the recipe and return ONLY this JSON (use null for missing fields):
${jsonTemplate}

Content:
${pageText.slice(0, 9000)}`;

  if (LOVABLE_API_KEY) {
    try {
      const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a recipe extraction assistant. Return ONLY valid JSON.' },
            { role: 'user', content: textPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1500,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const raw = data.choices?.[0]?.message?.content ?? '';
        const clean = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        return JSON.parse(clean);
      }
    } catch (e) {
      console.error('Lovable AI text failed:', e);
    }
  }

  if (!GROQ_API_KEY) throw new Error('No AI API key configured');

  const groqRes = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'You are a recipe extraction assistant. Return ONLY valid JSON.' },
        { role: 'user', content: textPrompt },
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
  return JSON.parse(clean);
}

/** Ask Groq vision to read all text visible in one image */
async function readTextFromImage(dataUri: string): Promise<string> {
  const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
  if (!GROQ_API_KEY) return '';
  try {
      console.log(`Groq OCR: fetching image, dataUri length: ${dataUri.length}`);
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick-17b-128e-instruct',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUri } },
              {
                type: 'text',
                text: 'This is a cooking recipe photo. Extract ALL text visible in this image — recipe name, ingredient names, quantities, step numbers, cooking instructions, times, temperatures, and any other text. Output only the extracted text, nothing else.',
              },
            ],
          }],
          temperature: 0.1,
          max_tokens: 800,
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        console.error(`Groq OCR error: ${res.status} ${errText.slice(0, 100)}`);
        return '';
      }
      const data = await res.json();
      return data.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      console.error('Groq OCR exception:', e);
      return '';
    }
  }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { url } = await req.json();
    if (!url) throw new Error('URL is required');

    // 1. Fetch the page (follow redirects)
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

    const finalUrl = pageRes.url;
    const html = await pageRes.text();
    const isXhs = isXhsUrl(url) || isXhsUrl(finalUrl);

    console.log(`Fetched ${finalUrl}, isXHS: ${isXhs}, HTML length: ${html.length}`);

    let pageText = '';
    let ogImage: string | null = null;
    let imageUrls: string[] = [];
    let extractedAuthor = '';

    if (isXhs) {
      const xhsData = extractXhsData(html);
      if (xhsData) {
        pageText = `Title: ${xhsData.title}\nDescription: ${xhsData.desc}`;
        imageUrls = xhsData.imageUrls;
        ogImage = imageUrls[0] || null;
        extractedAuthor = xhsData.author || '';
        console.log(`XHS extracted: title="${xhsData.title}", author="${extractedAuthor}", images: ${imageUrls.length}`);
      }
    }
    
    if (!pageText || pageText.length < 30) {
      const extracted = extractFromHtml(html);
      if (extracted.text.length > pageText.length) pageText = extracted.text;
      if (!ogImage) ogImage = extracted.ogImage;
      if (imageUrls.length === 0) imageUrls = extracted.imageUrls;
    }

    console.log(`Page text length: ${pageText.length}, images found: ${imageUrls.length}`);

    // 2. VIDEO TRANSCRIPTION: If this is a video post, try to download and transcribe
    let recipe: any = null;
    
    if (isXhs && isVideoPost(html, url)) {
      console.log('Detected video post — attempting video transcription...');
      const videoUrl = extractXhsVideoUrl(html);
      
      if (videoUrl) {
        console.log(`Found video URL: ${videoUrl.slice(0, 120)}`);
        const videoData = await fetchVideoAsBase64(videoUrl);
        
        if (videoData) {
          try {
            recipe = await transcribeVideoAndExtract(videoData, pageText, ogImage);
            console.log('Video transcription successful!');
          } catch (e) {
            console.error('Video transcription failed, falling back to image extraction:', e);
          }
        } else {
          console.log('Could not download video, falling back to image extraction');
        }
      } else {
        console.log('No video URL found in page, falling back to image extraction');
      }
    }

    // 3. If video transcription didn't work, fall back to image-based extraction
    if (!recipe) {
      let imageDataUris: string[] = [];
      if (imageUrls.length > 0) {
        const referer = isXhs ? 'https://www.xiaohongshu.com/' : finalUrl;
        const imagesToFetch = imageUrls.slice(0, 4);
        const results = await Promise.all(imagesToFetch.map(u => fetchImageAsDataUri(u, referer)));
        imageDataUris = results.filter((u): u is string => u !== null);
        console.log(`Downloaded ${imageDataUris.length} images for vision`);
      }

      recipe = await extractRecipeWithVision(pageText, imageDataUris, ogImage);

      // If vision didn't get ingredients, try Groq OCR on images
      const hasIngredients = recipe.ingredients && recipe.ingredients.length > 0;
      if (!hasIngredients && imageDataUris.length > 0) {
        console.log('Vision extraction incomplete, trying Groq OCR fallback...');
        const ocrResults = await Promise.all(
          imageDataUris.slice(0, 3).map(uri => readTextFromImage(uri))
        );
        const ocrTexts = ocrResults.filter(t => t.trim().length > 10);
        console.log(`Groq OCR got text from ${ocrTexts.length} images`);
        
        if (ocrTexts.length > 0) {
          const combinedContent = [
            pageText.length > 20 ? `Page text:\n${pageText}` : '',
            `Text from recipe images:\n${ocrTexts.map((t, i) => `[Image ${i + 1}]\n${t}`).join('\n\n')}`,
          ].filter(Boolean).join('\n\n');
          
          recipe = await extractRecipeWithVision(combinedContent, [], ogImage);
        }
      }
    }

    // Use the first image as image_url if AI didn't set one
    if (!recipe.image_url && imageUrls.length > 0) {
      recipe.image_url = imageUrls[0];
    }

    // Add author to recipe data
    if (extractedAuthor && !recipe.author) {
      recipe.author = extractedAuthor;
    }

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
