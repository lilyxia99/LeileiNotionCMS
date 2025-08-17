import { Client } from "@notionhq/client";
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function getTagOptions() {
  try {
    const { NOTION_KEY, NOTION_DB } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      throw new Error('Missing NOTION_KEY or NOTION_DB environment variables');
    }

    const notion = new Client({ auth: NOTION_KEY });

    console.log('🚀 Retrieving database schema...');

    // Retrieve database schema
    const database = await notion.databases.retrieve({
      database_id: NOTION_DB
    });

    // Extract tag options specifically
    const tagProperty = database.properties.tag;
    
    if (!tagProperty) {
      console.log('❌ No "tag" property found in database');
      return;
    }

    if (tagProperty.type !== 'multi_select') {
      console.log(`❌ "tag" property is of type "${tagProperty.type}", expected "multi_select"`);
      return;
    }

    const tagOptions = tagProperty.multi_select.options;
    
    console.log('\n📋 Available tag options:');
    console.log('========================');
    
    tagOptions.forEach((option, index) => {
      console.log(`${index + 1}. ${option.name} (${option.color})`);
    });

    // Create a comma-separated list like Thomas Frank suggested
    const tagChoices = tagOptions.map(option => option.name).join(', ');
    console.log('\n🤖 For AI prompts, use this list:');
    console.log(`"${tagChoices}"`);

    // Also output as JSON for programmatic use
    console.log('\n📄 JSON format:');
    console.log(JSON.stringify(tagOptions, null, 2));

    return tagOptions;

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run the script
getTagOptions();
