const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

// Recipe list
const recipes = [
  { chinese: '丁丁炒面', english: 'dingding_fried_noodles', desc: 'Xinjiang-style diced lamb stir-fried noodles with hand-pulled noodles' },
  { chinese: '凉拌茄子', english: 'cold_eggplant_salad', desc: 'Chinese cold eggplant salad with garlic and chili sauce' },
  { chinese: '卤牛肉', english: 'braised_beef', desc: 'Chinese braised beef slices in aromatic soy sauce and spices' },
  { chinese: '小炒牛肉', english: 'stir_fried_beef', desc: 'Chinese stir-fried sliced beef with green peppers and onions' },
  { chinese: '干煸二节子', english: 'dry_fried_lamb_intestine', desc: 'Dry-fried lamb intestines with cumin and chili, Northwest Chinese style' },
  { chinese: '扁豆面旗子', english: 'flat_bean_noodle_soup', desc: 'Chinese flat bean soup with small diamond-shaped noodle pieces' },
  { chinese: '杏鲍菇牛肉粒', english: 'beef_and_oyster_mushroom_cubes', desc: 'Stir-fried beef cubes with sliced king oyster mushrooms' },
  { chinese: '椒麻鸡', english: 'sichuan_pepper_chicken', desc: 'Sichuan numbing spicy cold chicken with Sichuan peppercorns' },
  { chinese: '水煮花生', english: 'boiled_peanuts', desc: 'Chinese boiled peanuts in shells with star anise and salt' },
  { chinese: '清蒸鱼', english: 'steamed_fish', desc: 'Chinese steamed whole fish with ginger, scallions and soy sauce' },
  { chinese: '炒合菜', english: 'stir_fried_mixed_vegetables', desc: 'Chinese stir-fried mixed vegetables with eggs and bean sprouts' },
  { chinese: '炒烤肉', english: 'stir_fried_grilled_meat', desc: 'Xinjiang-style stir-fried cumin lamb with onions' },
  { chinese: '烤羊排', english: 'roast_lamb_chops', desc: 'Chinese roasted lamb chops with cumin and chili flakes' },
  { chinese: '白菜豆腐', english: 'cabbage_tofu_stew', desc: 'Chinese napa cabbage and soft tofu stew in light broth' },
  { chinese: '肉末茄子', english: 'minced_pork_eggplant', desc: 'Chinese braised eggplant with minced pork in garlic sauce' },
  { chinese: '葱烧豆腐', english: 'scallion_braised_tofu', desc: 'Chinese braised golden tofu with caramelized scallions' },
  { chinese: '蒜蓉娃娃菜', english: 'garlic_baby_cabbage', desc: 'Chinese steamed baby cabbage with minced garlic sauce' },
  { chinese: '蒜蓉豆角', english: 'garlic_string_beans', desc: 'Chinese dry-fried string beans with garlic' },
  { chinese: '西湖牛肉羹', english: 'west_lake_beef_soup', desc: 'West Lake beef soup with egg whites, Hangzhou style' },
  { chinese: '西葫芦饼', english: 'zucchini_pancake', desc: 'Chinese savory zucchini pancakes, pan-fried golden' },
  { chinese: '辣子鸡', english: 'spicy_chicken', desc: 'Sichuan spicy diced chicken with dried red chilies' },
  { chinese: '酸汤肥牛', english: 'sour_soup_fatty_beef', desc: 'Chinese sour and spicy soup with sliced fatty beef' },
  { chinese: '酸辣汤', english: 'hot_and_sour_soup', desc: 'Chinese hot and sour soup with tofu and egg drops' },
  { chinese: '韭菜盒子', english: 'chive_pancake', desc: 'Chinese pan-fried chive and egg stuffed pancakes' },
  { chinese: '鱼香肉丝', english: 'yu_xiang_pork', desc: 'Sichuan Yu Xiang shredded pork with garlic sauce' },
  { chinese: '麻婆豆腐', english: 'mapo_tofu', desc: 'Sichuan Mapo tofu with minced pork and Sichuan peppercorns' },
  { chinese: '黄面烤肉', english: 'yellow_noodle_with_roast_meat', desc: 'Xinjiang yellow noodles topped with grilled cumin lamb' },
];

// Download image from URL
function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filepath);
    https.get(url, (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(filepath);
      });
    }).on('error', (err) => {
      fs.unlink(filepath, () => {});
      reject(err);
    });
  });
}

// Generate image using DALL-E
async function generateImage(recipe) {
  const prompt = `Professional food photography of ${recipe.desc}. The dish is beautifully plated on a ceramic plate, shot from a 45-degree angle with soft natural lighting. Appetizing, vibrant colors, shallow depth of field, restaurant quality presentation. Authentic Chinese cuisine.`;

  console.log(`  Generating with DALL-E 3...`);

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

  return response.data[0].url;
}

// Main function
async function main() {
  console.log('='.repeat(50));
  console.log('Recipe Image Generator');
  console.log('='.repeat(50));
  console.log(`Total recipes: ${recipes.length}\n`);

  // Create output directory
  const outputDir = path.join(__dirname, 'generated_images');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const results = [];
  const errors = [];

  for (let i = 0; i < recipes.length; i++) {
    const recipe = recipes[i];
    console.log(`\n[${i + 1}/${recipes.length}] ${recipe.chinese} (${recipe.english})`);

    try {
      // Generate image
      const imageUrl = await generateImage(recipe);

      // Download image
      const outputPath = path.join(outputDir, `${recipe.english}.png`);
      await downloadImage(imageUrl, outputPath);
      console.log(`  Saved: ${outputPath}`);

      results.push({
        chinese: recipe.chinese,
        english: recipe.english,
        path: outputPath,
      });

      // Rate limiting - wait 3 seconds between requests to avoid rate limits
      if (i < recipes.length - 1) {
        console.log(`  Waiting 3 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }

    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      errors.push({
        recipe: recipe.english,
        error: error.message,
      });
      // Wait a bit longer on error
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log('GENERATION COMPLETE');
  console.log('='.repeat(50));
  console.log(`Successfully generated: ${results.length}/${recipes.length}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Images saved to: ${outputDir}`);

  if (errors.length > 0) {
    console.log('\nFailed recipes:');
    errors.forEach(e => console.log(`  - ${e.recipe}: ${e.error}`));
  }

  // Save results to JSON for upload script
  const resultsPath = path.join(outputDir, 'results.json');
  fs.writeFileSync(resultsPath, JSON.stringify({ results, errors }, null, 2));
  console.log(`\nResults saved to: ${resultsPath}`);

  console.log('\nNext step: Run the upload script to upload images to Supabase');
}

main().catch(console.error);
