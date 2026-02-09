// Export recipes from your original Supabase to JSON
// Run with: node scripts/export-recipes.mjs

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const SUPABASE_URL = 'https://mckovksdjqghddoxjwoc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY; // Pass your anon key

if (!SUPABASE_KEY) {
  console.log('Usage: SUPABASE_KEY=your_anon_key node scripts/export-recipes.mjs');
  console.log('\nOr manually export from Supabase Dashboard:');
  console.log('1. Go to https://supabase.com/dashboard');
  console.log('2. Open project mckovksdjqghddoxjwoc');
  console.log('3. Table Editor → recipes → Export to CSV');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function exportRecipes() {
  const { data, error } = await supabase
    .from('recipes')
    .select('*');

  if (error) {
    console.error('Error:', error.message);
    return;
  }

  // Remove user_id, save_count, is_published for clean import
  const cleanData = data.map(({ id, user_id, save_count, is_published, ...rest }) => rest);

  fs.writeFileSync('recipes-export.json', JSON.stringify(cleanData, null, 2));
  console.log(`Exported ${data.length} recipes to recipes-export.json`);
}

exportRecipes();
