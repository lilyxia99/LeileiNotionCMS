import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.resolve(__dirname, '../generated');

function convertRichText(richText = []) {
  return richText
    .map(({ plain_text, annotations }) => {
      let html = plain_text || '';
      if (annotations?.bold) html = `<strong>${html}</strong>`;
      if (annotations?.italic) html = `<em>${html}</em>`;
      if (annotations?.underline) html = `<u>${html}</u>`;
      if (annotations?.strikethrough) html = `<s>${html}</s>`;
      if (annotations?.code) html = `<code>${html}</code>`;
      if (annotations?.color && annotations.color !== 'default') {
        html = `<span style="color:${annotations.color}">${html}</span>`;
      }
      return html;
    })
    .join('');
}

function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${convertRichText(block.paragraph?.rich_text)}</p>`;
    case 'image':
      const imageUrl = block.image?.external?.url || block.image?.file?.url || '';
      return `<img src="${imageUrl}" alt="" class="content-image" />`;
    case 'heading_1':
      return `<h1>${convertRichText(block.heading_1?.rich_text)}</h1>`;
    case 'heading_2':
      return `<h2>${convertRichText(block.heading_2?.rich_text)}</h2>`;
    case 'heading_3':
      return `<h3>${convertRichText(block.heading_3?.rich_text)}</h3>`;
    case 'bulleted_list_item':
      return `<li>${convertRichText(block.bulleted_list_item?.rich_text)}</li>`;
    case 'numbered_list_item':
      return `<li>${convertRichText(block.numbered_list_item?.rich_text)}</li>`;
    case 'quote':
      return `<blockquote>${convertRichText(block.quote?.rich_text)}</blockquote>`;
    case 'code':
      return `<pre><code>${convertRichText(block.code?.rich_text)}</code></pre>`;
    default:
      return '';
  }
}

function generateHTML({ title, slug, content, description, titleImage }) {
  const body = content.map(renderBlock).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Leilei Xia</title>
  <meta name="description" content="${description || title}" />
  
  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --font-primary: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      --font-display: 'Playfair Display', Georgia, serif;
      --color-primary: #6366f1;
      --color-text-primary: #111827;
      --color-text-secondary: #6b7280;
      --color-bg-primary: #ffffff;
      --color-bg-secondary: #f9fafb;
      --color-border: #e5e7eb;
    }
    
    * { box-sizing: border-box; }
    
    body {
      margin: 0;
      font-family: var(--font-primary);
      line-height: 1.6;
      color: var(--color-text-primary);
      background: var(--color-bg-primary);
    }
    
    .container {
      max-width: 800px;
      margin: 0 auto;
      padding: 2rem 1rem;
    }
    
    .back-link {
      display: inline-flex;
      align-items: center;
      color: var(--color-primary);
      text-decoration: none;
      margin-bottom: 2rem;
      font-weight: 500;
    }
    
    .back-link:hover {
      text-decoration: underline;
    }
    
    .hero-image {
      width: 100%;
      height: 300px;
      object-fit: cover;
      border-radius: 12px;
      margin-bottom: 2rem;
    }
    
    h1 {
      font-family: var(--font-display);
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0 0 1rem 0;
      line-height: 1.2;
    }
    
    .content {
      font-size: 1.1rem;
      line-height: 1.7;
    }
    
    .content p {
      margin-bottom: 1.5rem;
    }
    
    .content-image {
      width: 100%;
      height: auto;
      border-radius: 8px;
      margin: 2rem 0;
    }
    
    .content h2 {
      font-family: var(--font-display);
      font-size: 1.8rem;
      margin: 2rem 0 1rem 0;
    }
    
    .content h3 {
      font-family: var(--font-display);
      font-size: 1.4rem;
      margin: 1.5rem 0 0.5rem 0;
    }
    
    blockquote {
      border-left: 4px solid var(--color-primary);
      padding-left: 1.5rem;
      margin: 2rem 0;
      font-style: italic;
      color: var(--color-text-secondary);
    }
    
    pre {
      background: var(--color-bg-secondary);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
    }
    
    @media (max-width: 768px) {
      .container {
        padding: 1rem;
      }
      
      h1 {
        font-size: 2rem;
      }
      
      .hero-image {
        height: 200px;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <a href="/" class="back-link">← Back to Portfolio</a>
    
    ${titleImage ? `<img src="${titleImage}" alt="${title}" class="hero-image" />` : ''}
    
    <h1>${title}</h1>
    
    <div class="content">
      ${body}
    </div>
  </div>
</body>
</html>`;
}

async function run() {
  try {
    // Use local API endpoint for development, or deployed URL for production
    const apiUrl = process.env.NODE_ENV === 'production' 
      ? 'https://leileinotioncms.netlify.app/api/getPage'
      : 'http://localhost:8888/api/getPage';
    
    console.log(`Fetching pages from: ${apiUrl}`);
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const pages = await response.json();
    console.log(`Found ${pages.length} pages to generate`);

    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    for (const page of pages) {
      // Extract additional data for better page generation
      const titleImage = page.titleImage || '';
      const description = page.description || '';
      
      const html = generateHTML({
        title: page.title,
        slug: page.slug,
        content: page.content,
        description,
        titleImage
      });
      
      const filename = `${page.slug || page.page_id}.html`;
      const filepath = path.join(OUTPUT_DIR, filename);

      fs.writeFileSync(filepath, html);
      console.log(`✅ Generated: ${filepath}`);
    }
    
    console.log(`\n🎉 Successfully generated ${pages.length} pages in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error generating pages:', error);
    process.exit(1);
  }
}

run();
