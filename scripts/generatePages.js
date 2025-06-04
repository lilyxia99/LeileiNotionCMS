import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch'; // if you're in ESM, use: import('node-fetch').then(...)
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../generated');
const NOTION_KEY = process.env; // adjust as needed

function convertRichText(richText = []) {
  return richText
    .map(({ plain_text, annotations }) => {
      let html = plain_text || '';
      if (annotations.bold) html = `<strong>${html}</strong>`;
      if (annotations.italic) html = `<em>${html}</em>`;
      if (annotations.underline) html = `<u>${html}</u>`;
      if (annotations.strikethrough) html = `<s>${html}</s>`;
      if (annotations.code) html = `<code>${html}</code>`;
      if (annotations.color && annotations.color !== 'default') {
        html = `<span style="background-color:${annotations.color}">${html}</span>`;
      }
      return html;
    })
    .join('');
}

function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${convertRichText(block.paragraph.rich_text)}</p>`;
    case 'image':
      return `<img src="${block.image.external?.url || ''}" alt="" />`;
    case 'heading_1':
      return `<h1>${convertRichText(block.heading_1.rich_text)}</h1>`;
    case 'heading_2':
      return `<h2>${convertRichText(block.heading_2.rich_text)}</h2>`;
    case 'heading_3':
      return `<h3>${convertRichText(block.heading_3.rich_text)}</h3>`;
    default:
      return '';
  }
}

function generateHTML({ title, slug, content }) {
  const body = content.map(renderBlock).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  ${body}
</body>
</html>`;
}

async function run() {
  const res = await fetch('https://leileinotioncms.netlify.app/api/getPage');
  const pages = await res.json();

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  for (const page of pages) {
    const html = generateHTML(page);
    const filename = `${page.slug || page.page_id}.html`; // fallback if slug is missing
    const filepath = path.join(OUTPUT_DIR, filename);

    fs.writeFileSync(filepath, html);
    console.log(`✅ Generated: ${filepath}`);
  }
}

run().catch(console.error);
