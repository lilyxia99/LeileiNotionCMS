import { Client } from "@notionhq/client";
import fetch from 'node-fetch';

// Configuration - Replace these with your actual values
const BUNNY_STORAGE_ZONE = 'leilei-website-2'; // Replace with your storage zone name
const BUNNY_BASE_URL = 'https://leileixia-website.b-cdn.net'; // Replace with your CDN URL
const BUNNY_STORAGE_API_URL = `https://storage.bunnycdn.com/${BUNNY_STORAGE_ZONE}`;
const ROOT_FOLDER = 'artworks'; // Replace with your preferred root folder, or '' for root

async function uploadToBunny(imageBuffer, fileName, folderPath, bunnyApi) {
  const uploadPath = ROOT_FOLDER 
    ? `${ROOT_FOLDER}/${folderPath}/${fileName}`
    : `${folderPath}/${fileName}`;

  const uploadUrl = `${BUNNY_STORAGE_API_URL}/${uploadPath}`;

  console.log(`📤 Uploading to: ${uploadPath}`);

  const response = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'AccessKey': bunnyApi,
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

async function processImageBlocks(blocks, notion, pageSlug, bunnyApi, imageIndex = { count: 0 }) {
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
          const bunnyUrl = await uploadToBunny(imageBuffer, fileName, pageSlug, bunnyApi);
          
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
      await processImageBlocks(block.children, notion, pageSlug, bunnyApi, imageIndex);
    }
  }
}

async function processPage(notion, page, bunnyApi) {
  console.log(`\n📄 Processing page: ${page.title} (${page.slug})`);
  
  if (!page.content || page.content.length === 0) {
    console.log(`⏭️  No content blocks found for page: ${page.title}`);
    return;
  }
  
  const imageIndex = { count: 0 };
  await processImageBlocks(page.content, notion, page.slug, bunnyApi, imageIndex);
  
  if (imageIndex.count === 0) {
    console.log(`ℹ️  No uploadable images found in page: ${page.title}`);
  } else {
    console.log(`✅ Processed ${imageIndex.count} images for page: ${page.title}`);
  }
}

export default async (req, context) => {
  try {
    const { NOTION_KEY, NOTION_DB, BUNNY_API } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      return new Response(JSON.stringify({ 
        error: 'Missing NOTION_KEY or NOTION_DB environment variables' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!BUNNY_API) {
      return new Response(JSON.stringify({ 
        error: 'Missing BUNNY_API environment variable' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize Notion client
    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Starting Notion image upload process...');
    console.log(`📁 Storage Zone: ${BUNNY_STORAGE_ZONE}`);
    console.log(`🌐 Base URL: ${BUNNY_BASE_URL}`);
    console.log(`📂 Root Folder: ${ROOT_FOLDER || '(root)'}`);

    // Query database directly instead of using API endpoint
    const response = await notion.databases.query({
      database_id: NOTION_DB,
      filter: {
        property: "Status",
        status: {
          equals: "done"
        }
      }
    });

    const pages = response.results.map((page) => ({
      Name: page.properties.Name.title[0]?.plain_text || 'Untitled',
      id: page.id,
      slug: page.properties.slug?.rich_text?.[0]?.plain_text || page.id,
      description: page.properties.description?.rich_text?.[0]?.plain_text || '',
      titleImage: page.properties.titleImage?.files?.[0]?.external?.url || '',
    }));

    // Recursive function to fetch block children
    async function fetchBlocksRecursively(blockId) {
      const blocks = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
      });
      
      // For each block, if it has children, fetch them recursively
      const blocksWithChildren = await Promise.all(
        blocks.results.map(async (block) => {
          if (block.has_children) {
            const children = await fetchBlocksRecursively(block.id);
            return {
              ...block,
              children: children
            };
          }
          return block;
        })
      );
      
      return blocksWithChildren;
    }

    // Fetch content for each page
    const pagesWithContent = await Promise.all(
      pages.map(async (page) => {
        const content = await fetchBlocksRecursively(page.id);
        return {
          page_id: page.id,
          title: page.Name,
          slug: page.slug,
          description: page.description,
          titleImage: page.titleImage,
          content: content,
        };
      })
    );

    console.log(`\n📚 Found ${pagesWithContent.length} pages to process`);

    // Process each page
    for (const page of pagesWithContent) {
      await processPage(notion, page, BUNNY_API);
    }

    console.log('\n🎉 Image upload process completed!');
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${pagesWithContent.length} pages`,
      processedPages: pagesWithContent.length
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error('\n❌ Error during image upload process:', error.message);
    console.error('Stack trace:', error.stack);
    
    return new Response(JSON.stringify({ 
      error: error.message,
      stack: error.stack 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
