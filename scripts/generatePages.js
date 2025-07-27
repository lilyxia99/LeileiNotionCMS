import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../dist/generated')
  : path.resolve(__dirname, '../generated');

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
  
  <style>
    /* CSS Custom Properties */
    :root {
      --font-primary: var(--font-humanist);
      --font-display: var(--font-humanist);
      --color-primary: #6366f1;
      --color-primary-dark: #4f46e5;
      --color-accent: #f59e0b;
      --color-text-primary: #111827;
      --color-text-secondary: #6b7280;
      --color-text-light: #9ca3af;
      --color-bg-primary: #ffffff;
      --color-bg-secondary: #f9fafb;
      --color-bg-tertiary: #f3f4f6;
      --color-border: #e5e7eb;
      --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
      --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
      --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    }

    /* Reset and base styles */
    * {
      box-sizing: border-box;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      margin: 0;
      font-family: var(--font-primary);
      line-height: 1.6;
      color: var(--color-text-primary);
      background: var(--color-bg-primary);
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    /* Navigation */
    .nav {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-bottom: 1px solid var(--color-border);
      z-index: 1000;
      transition: all 0.3s ease;
    }

    .nav__container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 var(--size-4, 1rem);
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 70px;
    }

    .nav__logo {
      font-family: var(--font-display);
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0;
      color: var(--color-text-primary);
      text-decoration: none;
    }

    .nav__links {
      display: flex;
      gap: var(--size-6, 2rem);
    }

    .nav__link {
      text-decoration: none;
      color: var(--color-text-secondary);
      font-weight: 500;
      transition: color 0.2s ease;
      position: relative;
    }

    .nav__link:hover {
      color: var(--color-primary);
    }

    .nav__link::after {
      content: '';
      position: absolute;
      bottom: -4px;
      left: 0;
      width: 0;
      height: 2px;
      background: var(--color-primary);
      transition: width 0.2s ease;
    }

    .nav__link:hover::after {
      width: 100%;
    }
    
    /* Main content */
    .main-content {
      max-width: 900px;
      margin: 0 auto;
      padding: 120px var(--size-4, 1rem) var(--size-8, 3rem);
    }
    
    .back-link {
      display: inline-flex;
      align-items: center;
      color: var(--color-primary);
      text-decoration: none;
      margin-bottom: var(--size-6, 2rem);
      font-weight: 500;
      transition: color 0.2s ease;
    }
    
    .back-link:hover {
      color: var(--color-primary-dark);
    }
    
    .hero-image {
      width: 100%;
      height: 400px;
      object-fit: cover;
      border-radius: 16px;
      margin-bottom: var(--size-6, 2rem);
      box-shadow: var(--shadow-lg);
    }
    
    .page-title {
      font-family: var(--font-display);
      font-size: clamp(2.5rem, 5vw, 3.5rem);
      font-weight: 600;
      margin: 0 0 var(--size-4, 1.5rem) 0;
      line-height: 1.2;
      color: var(--color-text-primary);
    }
    
    .page-description {
      font-size: 1.2rem;
      color: var(--color-text-secondary);
      margin-bottom: var(--size-8, 3rem);
      line-height: 1.6;
    }
    
    .content {
      font-size: 1.1rem;
      line-height: 1.7;
      color: var(--color-text-primary);
    }
    
    .content p {
      margin-bottom: var(--size-4, 1.5rem);
    }
    
    .content-image {
      width: 100%;
      height: auto;
      border-radius: 12px;
      margin: var(--size-6, 2rem) 0;
      box-shadow: var(--shadow-md);
    }
    
    .content h1 {
      font-family: var(--font-display);
      font-size: 2.2rem;
      font-weight: 600;
      margin: var(--size-8, 3rem) 0 var(--size-4, 1.5rem) 0;
      color: var(--color-text-primary);
    }
    
    .content h2 {
      font-family: var(--font-display);
      font-size: 1.8rem;
      font-weight: 600;
      margin: var(--size-6, 2rem) 0 var(--size-3, 1rem) 0;
      color: var(--color-text-primary);
    }
    
    .content h3 {
      font-family: var(--font-display);
      font-size: 1.4rem;
      font-weight: 600;
      margin: var(--size-4, 1.5rem) 0 var(--size-2, 0.75rem) 0;
      color: var(--color-text-primary);
    }
    
    .content blockquote {
      border-left: 4px solid var(--color-primary);
      padding-left: var(--size-4, 1.5rem);
      margin: var(--size-6, 2rem) 0;
      font-style: italic;
      color: var(--color-text-secondary);
      background: var(--color-bg-secondary);
      padding: var(--size-4, 1.5rem);
      border-radius: 8px;
    }
    
    .content pre {
      background: var(--color-bg-secondary);
      padding: var(--size-4, 1.5rem);
      border-radius: 12px;
      overflow-x: auto;
      border: 1px solid var(--color-border);
    }
    
    .content code {
      background: var(--color-bg-tertiary);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.9em;
    }
    
    .content pre code {
      background: none;
      padding: 0;
    }
    
    .content ul, .content ol {
      padding-left: var(--size-6, 2rem);
      margin-bottom: var(--size-4, 1.5rem);
    }
    
    .content li {
      margin-bottom: var(--size-2, 0.75rem);
    }
    
    /* Column Layout Styles */
    .column-list {
      display: flex;
      gap: var(--size-4, 1.5rem);
      margin: var(--size-4, 1.5rem) 0;
    }
    
    .column {
      flex: 1;
      min-width: 0; /* Prevents flex items from overflowing */
    }
    
    .block-with-children {
      margin: var(--size-2, 0.75rem) 0;
    }

    /* Responsive Design */
    @media (max-width: 768px) {
      .nav__links {
        display: none;
      }
      
      .nav__container {
        justify-content: center;
      }
      
      .main-content {
        padding: 100px var(--size-3, 0.75rem) var(--size-6, 2rem);
      }
      
      .hero-image {
        height: 250px;
        border-radius: 12px;
      }
      
      .page-title {
        font-size: 2rem;
      }
      
      .page-description {
        font-size: 1.1rem;
      }
      
      .content {
        font-size: 1rem;
      }
      
      /* Stack columns vertically on mobile */
      .column-list {
        flex-direction: column;
        gap: var(--size-2, 0.75rem);
      }
    }

    @media (max-width: 480px) {
      .nav__container {
        height: 60px;
      }
      
      .main-content {
        padding: 80px var(--size-2, 0.5rem) var(--size-4, 1.5rem);
      }
      
      .hero-image {
        height: 200px;
      }
    }
  </style>
</head>
<body>
  <!-- Navigation -->
  <nav class="nav">
    <div class="nav__container">
      <div class="nav__brand">
        <a href="/" class="nav__logo">Leilei Xia</a>
      </div>
      <div class="nav__links">
        <a href="/#about" class="nav__link">About</a>
        <a href="/#work" class="nav__link">Work</a>
        <a href="/#contact" class="nav__link">Contact</a>
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
