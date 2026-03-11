import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body for mode and limit
    let mode = "missing";
    let limit = 5;
    try {
      const body = await req.json();
      mode = body?.mode || "missing";
      limit = body?.limit || 5;
    } catch { /* default */ }

    let query = supabase.from("recipes").select("id, name, english_name, image_url");

    if (mode === "wikimedia") {
      query = query.or("image_url.ilike.%wikimedia%,image_url.ilike.%wikipedia%");
    } else {
      query = query.or("image_url.is.null,image_url.eq.");
    }

    const { data: recipes, error } = await query.order("id").limit(limit);

    if (error) throw error;
    if (!recipes || recipes.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "All recipes have images!", updated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Generating images for ${recipes.length} recipes`);
    const results: any[] = [];

    for (const recipe of recipes) {
      const dishName = recipe.english_name
        ? recipe.english_name.replace(/_/g, " ")
        : recipe.name;

      console.log(`Generating image for: ${recipe.name} (${dishName})`);

      try {
        // Generate image using Lovable AI
        const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash-image",
            messages: [
              {
                role: "user",
                content: `Generate a beautiful, appetizing food photography image of the Chinese dish "${dishName}" (${recipe.name}). The dish should be plated on a nice dish or bowl, shot from a slightly elevated angle with warm lighting. Professional food photography style. No text or watermarks.`,
              },
            ],
            modalities: ["image", "text"],
          }),
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`AI error for ${recipe.name}: ${aiResponse.status} ${errText}`);
          results.push({ id: recipe.id, name: recipe.name, status: "ai_error" });
          await new Promise((r) => setTimeout(r, 2000));
          continue;
        }

        const aiData = await aiResponse.json();
        const imageDataUrl = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageDataUrl) {
          console.error(`No image returned for ${recipe.name}`);
          results.push({ id: recipe.id, name: recipe.name, status: "no_image" });
          continue;
        }

        // Extract base64 data and upload to storage
        const base64Data = imageDataUrl.split(",")[1];
        const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

        const fileName = `generated/${recipe.id}_${(recipe.english_name || recipe.name).replace(/[^a-zA-Z0-9]/g, "_")}.png`;

        const { error: uploadError } = await supabase.storage
          .from("recipe-images")
          .upload(fileName, binaryData, {
            contentType: "image/png",
            upsert: true,
          });

        if (uploadError) {
          console.error(`Upload error for ${recipe.name}:`, uploadError);
          results.push({ id: recipe.id, name: recipe.name, status: "upload_error" });
          continue;
        }

        // Get public URL
        const { data: urlData } = supabase.storage.from("recipe-images").getPublicUrl(fileName);
        const publicUrl = urlData.publicUrl;

        // Update recipe
        const { error: updateError } = await supabase
          .from("recipes")
          .update({ image_url: publicUrl })
          .eq("id", recipe.id);

        if (updateError) {
          console.error(`Update error for ${recipe.name}:`, updateError);
          results.push({ id: recipe.id, name: recipe.name, status: "update_error" });
        } else {
          console.log(`✓ Generated and saved image for ${recipe.name}`);
          results.push({ id: recipe.id, name: recipe.name, image_url: publicUrl, status: "updated" });
        }

        // Rate limit delay
        await new Promise((r) => setTimeout(r, 3000));
      } catch (e) {
        console.error(`Error processing ${recipe.name}:`, e);
        results.push({ id: recipe.id, name: recipe.name, status: "error" });
      }
    }

    const updated = results.filter((r) => r.status === "updated").length;
    return new Response(
      JSON.stringify({ success: true, total: recipes.length, updated, results }),
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
