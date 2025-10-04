import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.NODE_ENV === 'production' 
  ? path.resolve(__dirname, '../dist/generated')
  : path.resolve(__dirname, '../generated');

// Extract and minify page-specific CSS
function extractPageCSS() {
  try {
    const cssPath = path.resolve(__dirname, '../src/style.css');
    const fullCSS = fs.readFileSync(cssPath, 'utf8');
    
    // Extract essential sections for pages including dark mode
    const essentialSections = [
      // CSS Custom Properties (including dark mode)
      /:root\s*{[\s\S]*?}/,
      /\[data-theme="dark"\]\s*{[\s\S]*?}/,
      // Reset and base styles
      /\*\s*{\s*box-sizing:\s*border-box;\s*}/,
      /html\s*{[\s\S]*?}/,
      /body\s*{[\s\S]*?}/,
      /\.container\s*{[\s\S]*?}/,
      // Generated Page Styles section
      /\/\* Generated Page Styles \*\/[\s\S]*?(?=\/\* Generated Page Responsive Design \*\/)/,
      // Generated Page Responsive Design section  
      /\/\* Generated Page Responsive Design \*\/[\s\S]*?(?=@media \(max-width: 480px\))/,
      // Final mobile responsive section
      /@media \(max-width: 480px\)[\s\S]*?(?=\n\/\*|$)/
    ];
    
    let pageCSS = '';
    essentialSections.forEach(regex => {
      const match = fullCSS.match(regex);
      if (match) {
        pageCSS += match[0] + '\n';
      }
    });
    
    // If no sections found, include the entire CSS (fallback)
    if (!pageCSS.trim()) {
      pageCSS = fullCSS;
    }
    
    // Minify CSS by removing comments, extra whitespace, and newlines
    return pageCSS
      .replace(/\/\*[\s\S]*?\*\//g, '') // Remove comments
      .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
      .replace(/;\s*}/g, '}') // Remove semicolon before closing brace
      .replace(/\s*{\s*/g, '{') // Remove spaces around opening brace
      .replace(/;\s*/g, ';') // Remove spaces after semicolons
      .replace(/,\s*/g, ',') // Remove spaces after commas
      .trim();
  } catch (error) {
    console.warn('Could not read main CSS file:', error.message);
    return '';
  }
}

// Create minified page CSS file
function createPageCSSFile() {
  const pageCSS = extractPageCSS();
  const cssFilePath = path.join(OUTPUT_DIR, 'page-styles.min.css');
  fs.writeFileSync(cssFilePath, pageCSS);
  console.log(`✅ Created minified CSS file: ${cssFilePath}`);
  return 'page-styles.min.css';
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

function escapeHtmlAttribute(text) {
  return text
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&/g, '&amp;');
}

function convertToEmbedUrl(url) {
  // YouTube URL conversion
  if (url.includes('youtube.com') || url.includes('youtu.be')) {
    let videoId = '';
    
    if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1].split('?')[0];
    } else if (url.includes('youtube.com/watch?v=')) {
      videoId = url.split('v=')[1].split('&')[0];
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}`;
    }
  }
  
  // Vimeo URL conversion
  if (url.includes('vimeo.com')) {
    const videoId = url.split('vimeo.com/')[1].split('?')[0];
    if (videoId) {
      return `https://player.vimeo.com/video/${videoId}`;
    }
  }
  
  // Return original URL if no conversion needed
  return url;
}

function renderBlock(block) {
  switch (block.type) {
    case 'paragraph':
      return `<p>${convertRichText(block.paragraph?.rich_text)}</p>`;
    case 'image':
      const imageUrl = block.image?.external?.url || block.image?.file?.url || '';
      const altText = escapeHtmlAttribute(convertRichText(block.image?.caption || []));
      return `<img src="${imageUrl}" alt="${altText}" class="content-image" />`;
    case 'video':
      const videoUrl = block.video?.external?.url || block.video?.file?.url || '';
      if (videoUrl) {
        const embedUrl = convertToEmbedUrl(videoUrl);
        const caption = convertRichText(block.video?.caption || []);
        return `<div class="video-wrapper"><iframe src="${embedUrl}" frameborder="0" allowfullscreen class="content-video"></iframe>${caption ? `<p class="video-caption">${caption}</p>` : ''}</div>`;
      }
      return '';
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

function decodeHtmlEntities(text) {
  const entities = {
    '&lt;': '<',
    '&gt;': '>',
    '&amp;': '&',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
    '&lt;br&gt;': '<br>',
    '&lt;b&gt;': '<b>',
    '&lt;/b&gt;': '</b>',
    '&lt;i&gt;': '<i>',
    '&lt;/i&gt;': '</i>'
  };
  
  return text.replace(/&[#\w]+;/g, (entity) => entities[entity] || entity);
}

function generateHTML({ title, slug, content, description, titleImage }, cssFileName) {
  const body = content.map(renderBlock).join('');
  
  // Decode HTML entities in description
  const decodedDescription = description ? decodeHtmlEntities(description) : '';
  
  // Minify HTML by removing extra whitespace and newlines
  const minifiedHTML = `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${title} - Leilei Xia</title><meta name="description" content="${decodedDescription || title}"/><link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🎨</text></svg>"/><link rel="stylesheet" href="https://unpkg.com/open-props"/><link rel="stylesheet" href="https://unpkg.com/open-props/normalize.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/buttons.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/indigo.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/indigo-hsl.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/easings.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/animations.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/sizes.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/gradients.min.css"/><link rel="stylesheet" href="https://unpkg.com/open-props/fonts.min.css"/><link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=Pangolin&display=swap" rel="stylesheet"><link rel="stylesheet" href="${cssFileName}"/></head><body><script>const savedTheme=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',savedTheme);</script><nav class="page-nav"><div class="page-nav__container"><div class="nav__brand"><a href="/" class="page-nav__logo">Leilei Xia</a></div><div class="page-nav__links"><a href="/#about" class="page-nav__link">About</a><a href="/#work" class="page-nav__link">Work</a><a href="/#contact" class="page-nav__link">Contact</a><button class="theme-toggle" onclick="toggleTheme()" aria-label="Toggle dark mode"><svg class="sun-icon" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z"/></svg><svg class="moon-icon" fill="currentColor" viewBox="0 0 24 24"><path fill-rule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clip-rule="evenodd"/></svg></button></div></div></nav><main class="main-content"><a href="/" class="back-link">← Back to Portfolio</a>${titleImage ? `<img src="${titleImage}" alt="${title}" class="hero-image"/>` : ''}<h1 class="page-title">${title}</h1>${decodedDescription ? `<div class="page-description">${decodedDescription}</div>` : ''}<div class="content">${body}</div></main><script>function toggleTheme(){const currentTheme=document.documentElement.getAttribute('data-theme');const newTheme=currentTheme==='dark'?'light':'dark';document.documentElement.setAttribute('data-theme',newTheme);localStorage.setItem('theme',newTheme);}</script></body></html>`;
  
  return minifiedHTML;
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
    console.log(`Found ${pages.length} pages to generate (including private pages)`);

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

    // Create the minified CSS file once
    const cssFileName = createPageCSSFile();

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
      }, cssFileName);

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
