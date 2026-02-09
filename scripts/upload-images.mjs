import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SUPABASE_URL = 'https://mckovksdjqghddoxjwoc.supabase.co';
const BUCKET = 'recipe_images';

async function main() {
  const imagesDir = path.join(__dirname, 'generated_images');
  const projectDir = path.join(__dirname, '..');

  const files = fs.readdirSync(imagesDir).filter(f => f.endsWith('.png'));
  console.log(`Uploading ${files.length} images to Supabase...\n`);

  const results = [];
  const errors = [];

  for (const file of files) {
    const filepath = path.join(imagesDir, file);
    console.log(`Uploading: ${file}`);

    try {
      const cmd = `npx supabase --experimental storage cp "${filepath}" ss:///${BUCKET}/${file} --upsert`;
      execSync(cmd, {
        cwd: projectDir,
        stdio: 'pipe',
        env: { ...process.env }
      });

      const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file}`;
      console.log(`  OK: ${publicUrl}`);

      results.push({ file, url: publicUrl });
    } catch (error) {
      console.error(`  ERROR: ${error.message}`);
      errors.push({ file, error: error.message });
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`Uploaded: ${results.length}/${files.length}`);
  console.log(`Errors: ${errors.length}`);

  // Generate SQL
  console.log('\n-- SQL UPDATE STATEMENTS --\n');
  const sqlStatements = results.map(r => {
    const englishName = r.file.replace('.png', '');
    return `UPDATE recipes SET image_url = '${r.url}' WHERE LOWER(REPLACE(english_name, ' ', '_')) = '${englishName}';`;
  });

  sqlStatements.forEach(s => console.log(s));

  // Save SQL file
  const sqlPath = path.join(imagesDir, 'update_images.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`\nSQL saved to: ${sqlPath}`);
}

main().catch(console.error);
