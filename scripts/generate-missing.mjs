import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

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

async function main() {
  console.log('Generating missing image: dingding_fried_noodles');

  const prompt = `Professional food photography of Xinjiang-style diced lamb stir-fried noodles with hand-pulled noodles. The dish is beautifully plated on a ceramic plate, shot from a 45-degree angle with soft natural lighting. Appetizing, vibrant colors, shallow depth of field, restaurant quality presentation. Authentic Chinese cuisine.`;

  const response = await openai.images.generate({
    model: 'dall-e-3',
    prompt: prompt,
    n: 1,
    size: '1024x1024',
    quality: 'standard',
  });

  const imageUrl = response.data[0].url;
  const outputDir = path.join(__dirname, 'generated_images');
  const outputPath = path.join(outputDir, 'dingding_fried_noodles.png');

  await downloadImage(imageUrl, outputPath);
  console.log(`Saved: ${outputPath}`);
  console.log('Done!');
}

main().catch(console.error);
