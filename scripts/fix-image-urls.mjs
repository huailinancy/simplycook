import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

console.log('Using URL:', SUPABASE_URL);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Recipe mapping: Chinese name -> expected filename (without extension)
const recipeMapping = [
  { name: '丁丁炒面', english: 'dingding_fried_noodles' },
  { name: '凉拌茄子', english: 'cold_eggplant_salad' },
  { name: '卤牛肉', english: 'braised_beef' },
  { name: '小炒牛肉', english: 'stir_fried_beef' },
  { name: '干煸二节子', english: 'dry_fried_lamb_intestine' },
  { name: '扁豆面旗子', english: 'flat_bean_noodle_soup' },
  { name: '杏鲍菇牛肉粒', english: 'beef_and_oyster_mushroom_cubes' },
  { name: '椒麻鸡', english: 'sichuan_pepper_chicken' },
  { name: '水煮花生', english: 'boiled_peanuts' },
  { name: '清蒸鱼', english: 'steamed_fish' },
  { name: '炒合菜', english: 'stir_fried_mixed_vegetables' },
  { name: '炒烤肉', english: 'stir_fried_grilled_meat' },
  { name: '烤羊排', english: 'roast_lamb_chops' },
  { name: '白菜豆腐', english: 'cabbage_tofu_stew' },
  { name: '肉末茄子', english: 'minced_pork_eggplant' },
  { name: '葱烧豆腐', english: 'scallion_braised_tofu' },
  { name: '蒜蓉娃娃菜', english: 'garlic_baby_cabbage' },
  { name: '蒜蓉豆角', english: 'garlic_string_beans' },
  { name: '西湖牛肉羹', english: 'west_lake_beef_soup' },
  { name: '西葫芦饼', english: 'zucchini_pancake' },
  { name: '辣子鸡', english: 'spicy_chicken' },
  { name: '酸汤肥牛', english: 'sour_soup_fatty_beef' },
  { name: '酸辣汤', english: 'hot_and_sour_soup' },
  { name: '韭菜盒子', english: 'chive_pancake' },
  { name: '鱼香肉丝', english: 'yu_xiang_pork' },
  { name: '麻婆豆腐', english: 'mapo_tofu' },
  { name: '黄面烤肉', english: 'yellow_noodle_with_roast_meat' },
];

async function main() {
  console.log('Fetching recipes from database...\n');

  // Get recipes from database
  const { data: recipes, error: dbError } = await supabase
    .from('recipes')
    .select('id, name, english_name, image_url')
    .order('id');

  if (dbError) {
    console.error('Error fetching recipes:', dbError);
    return;
  }

  console.log(`Found ${recipes.length} recipes in database.\n`);

  const updates = [];

  for (const recipe of recipes) {
    // Find matching mapping by Chinese name
    const mapping = recipeMapping.find(m => m.name === recipe.name);

    if (mapping) {
      // The uploaded files are .png
      const filename = `${mapping.english}.png`;
      const correctUrl = `${SUPABASE_URL}/storage/v1/object/public/recipe_images/${filename}`;

      console.log(`Recipe: ${recipe.name} (ID: ${recipe.id})`);
      console.log(`  Current URL: ${recipe.image_url || 'NULL'}`);
      console.log(`  Correct URL: ${correctUrl}`);

      if (recipe.image_url !== correctUrl) {
        console.log(`  STATUS: NEEDS UPDATE`);
        updates.push({ id: recipe.id, name: recipe.name, url: correctUrl });
      } else {
        console.log(`  STATUS: OK`);
      }
      console.log('');
    }
  }

  if (updates.length === 0) {
    console.log('\nAll image URLs are correct!');
    return;
  }

  console.log(`${'='.repeat(60)}`);
  console.log(`Found ${updates.length} recipes needing URL updates.`);
  console.log('='.repeat(60));

  // Generate SQL for update
  console.log('\nSQL UPDATE statements:\n');
  const sqlStatements = updates.map(u =>
    `UPDATE recipes SET image_url = '${u.url}' WHERE id = ${u.id};`
  );
  sqlStatements.forEach(s => console.log(s));

  // Save SQL to file
  const fs = await import('fs');
  fs.writeFileSync(path.join(__dirname, 'update_image_urls.sql'), sqlStatements.join('\n'));
  console.log('\nSQL saved to: scripts/update_image_urls.sql');

  console.log('\nRun the SQL in Supabase SQL Editor to update the URLs.');
}

main().catch(console.error);
