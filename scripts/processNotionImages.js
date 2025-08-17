import { Client } from "@notionhq/client";
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Configuration
const SUPABASE_BUCKET = 'notion-images';

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
  
  let extension = 'jpg';
  const extensionMatch = lastPart.match(/\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i);
  if (extensionMatch) {
    extension = extensionMatch[1];
  }
  
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
    if (block.type === 'image' && block.image) {
      const image = block.image;
      
      if (image.type === 'file' && image.file && image.file.url) {
        try {
          console.log(`\n🖼️  Processing image in block ${block.id}`);
          
          const imageBuffer = await downloadImage(image.file.url);
          const fileName = generateFileName(image.file.url, imageIndex.count++);
          const supabaseUrl_new = await uploadToSupabase(imageBuffer, fileName, pageSlug, supabaseUrl, supabaseKey);
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
        }
      }
    }
    
    if (block.children && block.children.length > 0) {
      await processImageBlocks(block.children, notion, pageSlug, supabaseUrl, supabaseKey, imageIndex, uploadedUrls);
    }
  }
}

async function run() {
  try {
    const { NOTION_KEY, NOTION_DB, SUPASPACE_PROJECT_URL, SUPASPACE_SERVICE_KEY } = process.env;

    if (!NOTION_KEY || !NOTION_DB || !SUPASPACE_PROJECT_URL || !SUPASPACE_SERVICE_KEY) {
      throw new Error('Missing required environment variables');
    }

    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Starting Notion image processing...');

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
    }));

    async function fetchBlocksRecursively(blockId) {
      const blocks = await notion.blocks.children.list({
        block_id: blockId,
        page_size: 100,
      });
      
      const blocksWithChildren = await Promise.all(
        blocks.results.map(async (block) => {
          if (block.has_children) {
            const children = await fetchBlocksRecursively(block.id);
            return { ...block, children: children };
          }
          return block;
        })
      );
      
      return blocksWithChildren;
    }

    const pagesWithContent = await Promise.all(
      pages.map(async (page) => {
        const content = await fetchBlocksRecursively(page.id);
        return {
          title: page.Name,
          slug: page.slug,
          content: content,
        };
      })
    );

    const allUploadedUrls = [];

    for (const page of pagesWithContent) {
      if (page.content && page.content.length > 0) {
        const imageIndex = { count: 0 };
        await processImageBlocks(page.content, notion, page.slug, SUPASPACE_PROJECT_URL, SUPASPACE_SERVICE_KEY, imageIndex, allUploadedUrls);
      }
    }

    console.log(`\n🎉 Processed ${allUploadedUrls.length} images across ${pagesWithContent.length} pages`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

run();
