import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../dist/generated')
  : path.resolve(__dirname, '../generated');

// Read the main CSS file to inline it
function getMainCSS() {
  try {
    const cssPath = path.resolve(__dirname, '../src/style.css');
    return fs.readFileSync(cssPath, 'utf8');
  } catch (error) {
    console.warn('Could not read main CSS file:', error.message);
    return '';
  }
}

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
    case 'column_list':
      const columns = block.children ? block.children.map(renderBlock).join('') : '';
      return `<div class="column-list">${columns}</div>`;
    case 'column':
      const columnContent = block.children ? block.children.map(renderBlock).join('') : '';
      return `<div class="column">${columnContent}</div>`;
    default:
      // Handle blocks with children that aren't specifically handled
      if (block.children && block.children.length > 0) {
        const childrenHtml = block.children.map(renderBlock).join('');
        return `<div class="block-with-children">${childrenHtml}</div>`;
      }
      return '';
  }
}

function generateHTML({ title, slug, content, description, titleImage }) {
  const body = content.map(renderBlock).join('\n');
  const mainCSS = getMainCSS();
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} - Leilei Xia</title>
  <meta name="description" content="${description || title}" />
  
  <!-- Open Props -->
  <link rel="stylesheet" href="https://unpkg.com/open-props"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/normalize.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/buttons.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/indigo.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/indigo-hsl.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/easings.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/animations.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/sizes.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/gradients.min.css"/>
  <link rel="stylesheet" href="https://unpkg.com/open-props/fonts.min.css"/>
  
  <!-- Main Stylesheet - Inlined -->
  <style>
    ${mainCSS}
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav class="page-nav">
    <div class="page-nav__container">
      <div class="nav__brand">
        <a href="/" class="page-nav__logo">Leilei Xia</a>
      </div>
      <div class="page-nav__links">
        <a href="/#about" class="page-nav__link">About</a>
        <a href="/#work" class="page-nav__link">Work</a>
        <a href="/#contact" class="page-nav__link">Contact</a>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="main-content">
    <a href="/" class="back-link">← Back to Portfolio</a>
    
    ${titleImage ? `<img src="${titleImage}" alt="${title}" class="hero-image" />` : ''}
    
    <h1 class="page-title">${title}</h1>
    
    ${description ? `<p class="page-description">${description}</p>` : ''}
    
    <div class="content">
      ${body}
    </div>
  </main>
</body>
</html>`;
}

async function run() {
  try {
    // Import dotenv to load local environment variables
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
    } catch (e) {
      // dotenv not available, continue without it
    }

    // Try local development server first, then fallback to deployed URL
    let apiUrl = 'http://localhost:8888/api/getPage';
    let response;
    
    try {
      console.log(`Trying local development server: ${apiUrl}`);
      response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (localError) {
      console.log('Local server not available, trying deployed URL...');
      apiUrl = 'https://leileinotioncms.netlify.app/api/getPage';
      console.log(`Fetching pages from: ${apiUrl}`);
      response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    
    const pages = await response.json();
    console.log(`Found ${pages.length} pages to generate`);

        pages.forEach((page, index) => {
      console.log(`Page ${index + 1}:`);
      console.log(`  - Title: "${page.title}"`);
      console.log(`  - Slug: "${page.slug}"`);
      console.log(`  - Page ID: "${page.page_id}"`);
      console.log(`  - Has content: ${page.content ? page.content.length : 0} blocks`);
      console.log(`  - Description: "${page.description}"`);
      console.log(`  - Title Image: "${page.titleImage}"`);
      console.log('');
    });


    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    for (const page of pages) {
      // Extract additional data for better page generation
      const titleImage = page.titleImage || '';
      const description = page.description || '';
      const slug = page.slug || page.page_id || 'untitled';
      
      const html = generateHTML({
        title: page.title,
        slug: slug,
        content: page.content,
        description,
        titleImage
      });

      
      
      // Ensure slug is safe for filename
      const safeSlug = slug.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
      const filename = `${safeSlug}.html`;
      const filepath = path.join(OUTPUT_DIR, filename);

      fs.writeFileSync(filepath, html);
      console.log(`✅ Generated: ${filepath} (slug: ${slug})`);
    }
    
    console.log(`\n🎉 Successfully generated ${pages.length} pages in ${OUTPUT_DIR}`);
  } catch (error) {
    console.error('❌ Error generating pages:', error);
    console.error('Make sure either:');
    console.error('1. Your dev server is running (npm run dev) in another terminal, OR');
    console.error('2. Your site is deployed and accessible at the production URL');
    process.exit(1);
  }
}

run();
