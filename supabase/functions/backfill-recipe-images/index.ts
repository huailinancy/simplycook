import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Search Wikimedia Commons for a food image
async function findImageUrl(name: string, englishName?: string): Promise<string | null> {
  const queries = [
    englishName ? englishName.replace(/_/g, " ") : null,
    name,
    `${name} food`,
    `${name} dish`,
  ].filter(Boolean) as string[];

  for (const query of queries) {
    try {
      // Try Wikimedia Commons search
      const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query + " food")}&srnamespace=6&srlimit=5&format=json&origin=*`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();

      const results = data?.query?.search || [];
      for (const result of results) {
        const title = result.title;
        if (!title) continue;

        // Get the actual image URL
        const infoUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url&iiurlwidth=640&format=json&origin=*`;
        const infoRes = await fetch(infoUrl);
        if (!infoRes.ok) continue;
        const infoData = await infoRes.json();

        const pages = infoData?.query?.pages;
        if (!pages) continue;

        for (const pageId of Object.keys(pages)) {
          const imageInfo = pages[pageId]?.imageinfo?.[0];
          if (imageInfo?.thumburl) {
            // Filter out non-food images by checking file extension
            const thumbUrl = imageInfo.thumburl as string;
            if (thumbUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
              return thumbUrl;
            }
          }
          if (imageInfo?.url) {
            const imgUrl = imageInfo.url as string;
            if (imgUrl.match(/\.(jpg|jpeg|png|webp)/i)) {
              return imgUrl;
            }
          }
        }
      }

      // Try Wikipedia page image as fallback
      const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
      const wikiRes = await fetch(wikiUrl);
      if (wikiRes.ok) {
        const wikiData = await wikiRes.json();
        const wikiPages = wikiData?.query?.pages;
        if (wikiPages) {
          for (const pageId of Object.keys(wikiPages)) {
            const thumb = wikiPages[pageId]?.thumbnail?.source;
            if (thumb) return thumb;
          }
        }
      }

      // Try Chinese Wikipedia too
      const zhWikiUrl = `https://zh.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(query)}&prop=pageimages&piprop=thumbnail&pithumbsize=640&format=json&origin=*`;
      const zhRes = await fetch(zhWikiUrl);
      if (zhRes.ok) {
        const zhData = await zhRes.json();
        const zhPages = zhData?.query?.pages;
        if (zhPages) {
          for (const pageId of Object.keys(zhPages)) {
            const thumb = zhPages[pageId]?.thumbnail?.source;
            if (thumb) return thumb;
          }
        }
      }
    } catch (e) {
      console.error(`Search failed for "${query}":`, e);
    }
  }

  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch recipes without images
    const { data: recipes, error } = await supabase
      .from("recipes")
      .select("id, name, english_name")
      .or("image_url.is.null,image_url.eq.")
      .order("id");

    if (error) throw error;

    console.log(`Found ${recipes.length} recipes without images`);

    const results: { id: number; name: string; image_url: string | null; status: string }[] = [];

    for (const recipe of recipes) {
      console.log(`Searching image for: ${recipe.name} (${recipe.english_name || "no english name"})`);

      const imageUrl = await findImageUrl(recipe.name, recipe.english_name);

      if (imageUrl) {
        const { error: updateError } = await supabase
          .from("recipes")
          .update({ image_url: imageUrl })
          .eq("id", recipe.id);

        if (updateError) {
          console.error(`Failed to update recipe ${recipe.id}:`, updateError);
          results.push({ id: recipe.id, name: recipe.name, image_url: null, status: "update_failed" });
        } else {
          console.log(`✓ Updated recipe ${recipe.id} with image`);
          results.push({ id: recipe.id, name: recipe.name, image_url: imageUrl, status: "updated" });
        }
      } else {
        console.log(`✗ No image found for recipe ${recipe.id}: ${recipe.name}`);
        results.push({ id: recipe.id, name: recipe.name, image_url: null, status: "not_found" });
      }

      // Small delay to be nice to Wikipedia API
      await new Promise((r) => setTimeout(r, 500));
    }

    const updated = results.filter((r) => r.status === "updated").length;
    const notFound = results.filter((r) => r.status === "not_found").length;

    return new Response(
      JSON.stringify({
        success: true,
        total: recipes.length,
        updated,
        not_found: notFound,
        results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
