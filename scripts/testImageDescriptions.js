import { Client } from "@notionhq/client";
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function analyzeImageWithAI(imageUrl) {
  try {
    // Using OpenAI's GPT-4 Vision API for image analysis
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Describe this image in a simple, straightforward, and affirmative way for visually impaired readers. Focus on the main subject, key visual elements, colors, and any important details. Keep it concise but informative."
              },
              {
                type: "image_url",
                image_url: {
                  url: imageUrl
                }
              }
            ]
          }
        ],
        max_tokens: 150
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || "Image description unavailable";
  } catch (error) {
    console.error(`❌ Failed to analyze image ${imageUrl}:`, error.message);
    return "Image description unavailable";
  }
}

async function updateImageCaption(notion, blockId, newCaption) {
  try {
    console.log(`🔄 Updating image caption for block ${blockId}`);
    
    await notion.blocks.update({
      block_id: blockId,
      image: {
        caption: [
          {
            type: "text",
            text: {
              content: newCaption
            }
          }
        ]
      }
    });
    
    console.log(`✅ Successfully updated caption: "${newCaption}"`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to update caption for block ${blockId}:`, error.message);
    return false;
  }
}

async function processImageBlocks(blocks, notion, processedImages = []) {
  for (const block of blocks) {
    if (block.type === 'image' && block.image) {
      const imageUrl = block.image?.external?.url || block.image?.file?.url;
      
      if (imageUrl) {
        try {
          console.log(`\n🖼️  Processing image: ${imageUrl}`);
          
          // Get AI description of the image
          const description = await analyzeImageWithAI(imageUrl);
          console.log(`🤖 AI Description: "${description}"`);
          
          // Update the image caption in Notion
          const success = await updateImageCaption(notion, block.id, description);
          
          processedImages.push({
            blockId: block.id,
            imageUrl: imageUrl,
            description: description,
            updated: success
          });
          
          // Add a small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`❌ Failed to process image in block ${block.id}:`, error.message);
        }
      }
    }
    
    // Recursively process children blocks
    if (block.children && block.children.length > 0) {
      await processImageBlocks(block.children, notion, processedImages);
    }
  }
}

async function run() {
  try {
    const { NOTION_KEY, NOTION_DB, OPENAI_API_KEY } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      throw new Error('Missing NOTION_KEY or NOTION_DB environment variables');
    }

    if (!OPENAI_API_KEY) {
      throw new Error('Missing OPENAI_API_KEY environment variable. Please add your OpenAI API key to .env file');
    }

    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Starting image description test for "Expect" page...');

    // Query database for the "Expect" page
    const response = await notion.databases.query({
      database_id: NOTION_DB,
      filter: {
        property: "Name",
        title: {
          equals: "Expect"
        }
      }
    });

    if (response.results.length === 0) {
      console.log('❌ No page found with title "Expect"');
      return;
    }

    const expectPage = response.results[0];
    console.log(`✅ Found "Expect" page: ${expectPage.id}`);

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

    // Fetch all content blocks from the page
    const content = await fetchBlocksRecursively(expectPage.id);
    console.log(`📄 Found ${content.length} top-level blocks in the page`);

    // Process all images in the page
    const processedImages = [];
    await processImageBlocks(content, notion, processedImages);

    console.log(`\n🎉 Processing complete!`);
    console.log(`📊 Summary:`);
    console.log(`   - Total images processed: ${processedImages.length}`);
    console.log(`   - Successfully updated: ${processedImages.filter(img => img.updated).length}`);
    console.log(`   - Failed updates: ${processedImages.filter(img => !img.updated).length}`);

    if (processedImages.length > 0) {
      console.log(`\n📋 Processed images:`);
      processedImages.forEach((img, index) => {
        console.log(`${index + 1}. ${img.updated ? '✅' : '❌'} ${img.imageUrl}`);
        console.log(`   Description: "${img.description}"`);
        console.log('');
      });
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
run();
