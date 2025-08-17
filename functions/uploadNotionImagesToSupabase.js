import { Client } from "@notionhq/client";
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

// Configuration
const SUPABASE_BUCKET = 'LeileiWebsite'; // You can change this bucket name

async function uploadToSupabase(imageBuffer, fileName, folderPath, supabaseUrl, supabaseKey) {
  const supabase = createClient(supabaseUrl, supabaseKey);
  
  // Create bucket if it doesn't exist
  const { data: buckets } = await supabase.storage.listBuckets();
  const bucketExists = buckets?.some(bucket => bucket.name === SUPABASE_BUCKET);
  
  if (!bucketExists) {
    console.log(`📁 Creating bucket: ${SUPABASE_BUCKET}`);
    const { error: bucketError } = await supabase.storage.createBucket(SUPABASE_BUCKET, {
      public: true,
      allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
      fileSizeLimit: 10485760 // 10MB
    });
    
    if (bucketError) {
      console.error('Failed to create bucket:', bucketError);
      throw new Error(`Failed to create bucket: ${bucketError.message}`);
    }
  }

  const uploadPath = folderPath ? `${folderPath}/${fileName}` : fileName;
  
  console.log(`📤 Uploading to Supabase: ${uploadPath}`);

  const { data, error } = await supabase.storage
    .from(SUPABASE_BUCKET)
    .upload(uploadPath, imageBuffer, {
      contentType: getContentType(fileName),
      upsert: true
    });

  if (error) {
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from(SUPABASE_BUCKET)
    .getPublicUrl(uploadPath);

  const publicUrl = publicUrlData.publicUrl;
  console.log(`✅ Uploaded successfully: ${publicUrl}`);
  return publicUrl;
}

function getContentType(fileName) {
  const extension = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'svg': 'image/svg+xml'
  };
  return mimeTypes[extension] || 'image/jpeg';
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
  
  // Extract file extension from URL or query params
  let extension = 'jpg';
  const extensionMatch = lastPart.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);
  if (extensionMatch) {
    extension = extensionMatch[1];
  }
  
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
    return newImageUrl;
  } catch (error) {
    console.error(`❌ Failed to update Notion block ${blockId}:`, error.message);
    throw error;
  }
}

async function processImageBlocks(blocks, notion, pageSlug, supabaseUrl, supabaseKey, imageIndex = { count: 0 }, uploadedUrls = []) {
  for (const block of blocks) {
    // Process current block if it's an image with type "file"
    if (block.type === 'image' && block.image) {
      const image = block.image;
      
      // Check if it's a Notion-hosted file (temporary URL)
      if (image.type === 'file' && image.file && image.file.url) {
        try {
          console.log(`\n🖼️  Processing image in block ${block.id}`);
          console.log(`📍 Original URL: ${image.file.url}`);
          
          // Download the image
          const imageBuffer = await downloadImage(image.file.url);
          
          // Generate filename
          const fileName = generateFileName(image.file.url, imageIndex.count++);
          
          // Upload to Supabase
          const supabaseUrl_new = await uploadToSupabase(imageBuffer, fileName, pageSlug, supabaseUrl, supabaseKey);
          
          // Update the Notion block
          const updatedUrl = await updateNotionImageBlock(notion, block.id, supabaseUrl_new);
          uploadedUrls.push({
            blockId: block.id,
            originalUrl: image.file.url,
            newUrl: updatedUrl,
            fileName: fileName
          });
          
          console.log(`✅ Successfully processed image: ${fileName}`);
          
        } catch (error) {
          console.error(`❌ Failed to process image in block ${block.id}:`, error.message);
          // Continue processing other images even if one fails
        }
      } else if (image.type === 'external') {
        console.log(`⏭️  Skipping external image in block ${block.id} (already external)`);
      } else if (image.type === 'file_upload') {
        console.log(`⏭️  Skipping file_upload image in block ${block.id} (API uploaded)`);
      }
    }
    
    // Recursively process children blocks
    if (block.children && block.children.length > 0) {
      await processImageBlocks(block.children, notion, pageSlug, supabaseUrl, supabaseKey, imageIndex, uploadedUrls);
    }
  }
}

async function processPage(notion, page, supabaseUrl, supabaseKey, uploadedUrls) {
  console.log(`\n📄 Processing page: ${page.title} (${page.slug})`);
  
  if (!page.content || page.content.length === 0) {
    console.log(`⏭️  No content blocks found for page: ${page.title}`);
    return;
  }
  
  const imageIndex = { count: 0 };
  await processImageBlocks(page.content, notion, page.slug, supabaseUrl, supabaseKey, imageIndex, uploadedUrls);
  
  if (imageIndex.count === 0) {
    console.log(`ℹ️  No uploadable images found in page: ${page.title}`);
  } else {
    console.log(`✅ Processed ${imageIndex.count} images for page: ${page.title}`);
  }
}

export default async (req, context) => {
  try {
    const { NOTION_KEY, NOTION_DB, SUPASPACE_PROJECT_URL, SUPASPACE_ACCESS_KEY } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      return new Response(JSON.stringify({ 
        error: 'Missing NOTION_KEY or NOTION_DB environment variables' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!SUPASPACE_PROJECT_URL || !SUPASPACE_ACCESS_KEY) {
      return new Response(JSON.stringify({ 
        error: 'Missing SUPASPACE_PROJECT_URL or SUPASPACE_ACCESS_KEY environment variables' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Initialize Notion client
    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Starting Notion image upload to Supabase process...');
    console.log(`🗄️  Supabase URL: ${SUPASPACE_PROJECT_URL}`);
    console.log(`📁 Bucket: ${SUPABASE_BUCKET}`);

    // Query database directly
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

    // Track all uploaded URLs for debugging
    const allUploadedUrls = [];

    // Process each page
    for (const page of pagesWithContent) {
      await processPage(notion, page, SUPASPACE_PROJECT_URL, SUPASPACE_ACCESS_KEY, allUploadedUrls);
    }

    console.log('\n🎉 Image upload to Supabase process completed!');
    
    // Debug: Show all uploaded URLs
    if (allUploadedUrls.length > 0) {
      console.log('\n📋 All uploaded URLs:');
      allUploadedUrls.forEach((upload, index) => {
        console.log(`${index + 1}. Block: ${upload.blockId}`);
        console.log(`   File: ${upload.fileName}`);
        console.log(`   Original: ${upload.originalUrl}`);
        console.log(`   New URL: ${upload.newUrl}`);
        console.log('');
      });
    }
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Processed ${pagesWithContent.length} pages`,
      processedPages: pagesWithContent.length,
      uploadedImages: allUploadedUrls.length,
      uploadedUrls: allUploadedUrls
    }), {
      headers: { "Content-Type": "application/json" }
    });
    
  } catch (error) {
    console.error('\n❌ Error during image upload to Supabase process:', error.message);
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
