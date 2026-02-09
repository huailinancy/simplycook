const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SUPABASE_URL = 'https://mckovksdjqghddoxjwoc.supabase.co';
const BUCKET = 'recipe_images';

async function main() {
  const imagesDir = path.join(__dirname, 'generated_images');

  if (!fs.existsSync(imagesDir)) {
    console.error('No generated_images directory found. Run generate-recipe-images.js first.');
    process.exit(1);
  }

  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
  console.log(`Found ${files.length} images to upload\n`);

  const results = [];
  const errors = [];

  for (const file of files) {
    const filepath = path.join(imagesDir, file);
    console.log(`Uploading: ${file}`);

    try {
      // Use Supabase CLI to upload
      const cmd = `npx supabase --experimental storage cp "${filepath}" ss:///${BUCKET}/${file} --upsert`;
      execSync(cmd, {
        cwd: path.join(__dirname, '..'),
        stdio: 'pipe',
        env: { ...process.env }
      });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file}`;
      console.log(`  Uploaded: ${publicUrl}`);

      results.push({
        file,
        url: publicUrl,
        english_name: file.replace('.png', '').replace(/_/g, ' ')
      });

    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      errors.push({ file, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log('UPLOAD COMPLETE');
  console.log('='.repeat(50));
  console.log(`Uploaded: ${results.length}/${files.length}`);
  console.log(`Errors: ${errors.length}`);

  // Generate SQL update statements
  console.log('\n' + '='.repeat(50));
  console.log('SQL UPDATE STATEMENTS:');
  console.log('='.repeat(50));
  console.log('-- Run these in Supabase SQL Editor to update recipe image URLs:\n');

  results.forEach(r => {
    // Match by english_name column
    console.log(`UPDATE recipes SET image_url = '${r.url}' WHERE LOWER(REPLACE(english_name, ' ', '_')) = '${r.file.replace('.png', '')}';`);
  });

  // Save SQL to file
  const sqlPath = path.join(imagesDir, 'update_images.sql');
  const sqlContent = results.map(r =>
    `UPDATE recipes SET image_url = '${r.url}' WHERE LOWER(REPLACE(english_name, ' ', '_')) = '${r.file.replace('.png', '')}';`
  ).join('\n');
  fs.writeFileSync(sqlPath, sqlContent);
  console.log(`\nSQL saved to: ${sqlPath}`);
}

main().catch(console.error);
