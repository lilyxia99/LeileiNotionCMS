import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { Client } from "@notionhq/client";
const{NOTION_KEY,NOTION_DB} = process.env;

// Initializing a client
const notion = new Client({
  auth: NOTION_KEY,
})

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration - Replace these with your actual values
const BUNNY_STORAGE_ZONE = 'your-storage-zone-name'; // Replace with your storage zone name
const BUNNY_BASE_URL = 'https://your-storage-zone.b-cdn.net'; // Replace with your CDN URL
const BUNNY_STORAGE_API_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const ROOT_FOLDER = 'artworks'; // Replace with your preferred root folder, or '' for root

async function uploadToBunny(imageBuffer, fileName, folderPath) {
  const { BUNNY_API } = process.env;
  
  if (!BUNNY_API) {
    throw new Error('BUNNY_API environment variable is not set');
  }

  const uploadPath = ROOT_FOLDER 
    ? `${ROOT_FOLDER}/${folderPath}/${fileName}`
    : `${folderPath}/${fileName}`;

  const uploadUrl = `${BUNNY_STORAGE_API_URL}/${uploadPath}`;

  console.log(`📤 Uploading to: ${uploadPath}`);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': BUNNY_API,
      'Content-Type': 'application/octet-stream',
    },
    body: imageBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to Bunny.net: ${response.status} ${errorText}`);
  }

  const publicUrl = ROOT_FOLDER 
    ? `${BUNNY_BASE_URL}/${ROOT_FOLDER}/${folderPath}/${fileName}`
    : `${BUNNY_BASE_URL}/${folderPath}/${fileName}`;

  console.log(`✅ Uploaded successfully: ${publicUrl}`);
  return publicUrl;
}

async function downloadImage(url) {
  console.log(`📥 Downloading image from: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  
  return Buffer.from(await response.arrayBuffer());
}

function generateFileName(originalUrl, index = 0) {
  const urlParts = originalUrl.split('/');
  const lastPart = urlParts[urlParts.length - 1];
  
  // Extract file extension
  const extensionMatch = lastPart.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);
  const extension = extensionMatch ? extensionMatch[1] : 'jpg';
  
  // Generate a clean filename
  const timestamp = Date.now();
  const fileName = index > 0 
    ? `image-${timestamp}-${index}.${extension}`
    : `image-${timestamp}.${extension}`;
    
  return fileName;
}

async function updateNotionImageBlock(notion, blockId, newImageUrl) {
  console.log(`🔄 Updating Notion block ${blockId} with new URL: ${newImageUrl}`);
  
  try {
    await notion.blocks.update({
      block_id: blockId,
      image: {
        type: 'external',
        external: {
          url: newImageUrl
        }
      }
    });
    console.log(`✅ Successfully updated Notion block ${blockId}`);
  } catch (error) {
    console.error(`❌ Failed to update Notion block ${blockId}:`, error.message);
    throw error;
  }
}

async function processImageBlocks(blocks, notion, pageSlug, imageIndex = { count: 0 }) {
  for (const block of blocks) {
    // Process current block if it's an image
    if (block.type === 'image' && block.image) {
      const image = block.image;
      
      // Check if it's a file upload (not external)
      if (image.type === 'file' && image.file && image.file.url) {
        try {
          console.log(`\n🖼️  Processing image in block ${block.id}`);
          
          // Download the image
          const imageBuffer = await downloadImage(image.file.url);
          
          // Generate filename
          const fileName = generateFileName(image.file.url, imageIndex.count++);
          
          // Upload to Bunny.net
          const bunnyUrl = await uploadToBunny(imageBuffer, fileName, pageSlug);
          
          // Update the Notion block
          await updateNotionImageBlock(notion, block.id, bunnyUrl);
          
          console.log(`✅ Successfully processed image: ${fileName}`);
          
        } catch (error) {
          console.error(`❌ Failed to process image in block ${block.id}:`, error.message);
          // Continue processing other images even if one fails
        }
      } else if (image.type === 'external') {
        console.log(`⏭️  Skipping external image in block ${block.id} (already external)`);
      }
    }
    
    // Recursively process children blocks
    if (block.children && block.children.length > 0) {
      await processImageBlocks(block.children, notion, pageSlug, imageIndex);
    }
  }
}

async function processPage(notion, page) {
  console.log(`\n📄 Processing page: ${page.title} (${page.slug})`);
  
  if (!page.content || page.content.length === 0) {
    console.log(`⏭️  No content blocks found for page: ${page.title}`);
    return;
  }
  
  const imageIndex = { count: 0 };
  await processImageBlocks(page.content, notion, page.slug, imageIndex);
  
  if (imageIndex.count === 0) {
    console.log(`ℹ️  No uploadable images found in page: ${page.title}`);
  } else {
    console.log(`✅ Processed ${imageIndex.count} images for page: ${page.title}`);
  }
}

async function run() {
  try {
    // Load environment variables
    try {
      const dotenv = await import('dotenv');
      dotenv.config();
    } catch (e) {
      console.log('dotenv not available, using system environment variables');
    }

    const { NOTION_KEY, NOTION_DB, BUNNY_API } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      throw new Error('Missing NOTION_KEY or NOTION_DB environment variables');
    }

    if (!BUNNY_API) {
      throw new Error('Missing BUNNY_API environment variable');
    }

    // Initialize Notion client
    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Starting Notion image upload process...');
    console.log(`📁 Storage Zone: ${BUNNY_STORAGE_ZONE}`);
    console.log(`🌐 Base URL: ${BUNNY_BASE_URL}`);
    console.log(`📂 Root Folder: ${ROOT_FOLDER || '(root)'}`);

    // Fetch pages from local API or deployed API
    let apiUrl = 'http://localhost:8888/api/getPage';
    let response;
    
    try {
      console.log(`\n📡 Trying local development server: ${apiUrl}`);
      response = await fetch(apiUrl);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    } catch (localError) {
      console.log('Local server not available, trying deployed URL...');
      apiUrl = 'https://leileinotioncms.netlify.app/api/getPage';
      console.log(`📡 Fetching pages from: ${apiUrl}`);
      response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }
    
    const pages = await response.json();
    console.log(`\n📚 Found ${pages.length} pages to process`);

    // Process each page
    for (const page of pages) {
      await processPage(notion, page);
    }

    console.log('\n🎉 Image upload process completed!');
    
  } catch (error) {
    console.error('\n❌ Error during image upload process:', error.message);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  }
}

// Run the script
run();
