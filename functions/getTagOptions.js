import { Client } from "@notionhq/client";

export default async (req, context) => {
  try {
    const { NOTION_KEY, NOTION_DB } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      return new Response(JSON.stringify({ 
        error: 'Missing NOTION_KEY or NOTION_DB environment variables' 
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }

    const notion = new Client({ auth: NOTION_KEY });

    // Retrieve database schema
    const database = await notion.databases.retrieve({
      database_id: NOTION_DB
    });

    // Extract tag options specifically
    const tagProperty = database.properties.tag;
    
    if (!tagProperty) {
      return new Response(JSON.stringify({ 
        error: 'No "tag" property found in database' 
      }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (tagProperty.type !== 'multi_select') {
      return new Response(JSON.stringify({ 
        error: `"tag" property is of type "${tagProperty.type}", expected "multi_select"` 
      }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tagOptions = tagProperty.multi_select.options;
    
    // Create a comma-separated list like Thomas Frank suggested
    const tagChoices = tagOptions.map(option => option.name).join(', ');

    console.log("✅ Retrieved tag options from database");

    return new Response(JSON.stringify({
      success: true,
      tagOptions: tagOptions,
      tagChoicesString: tagChoices,
      count: tagOptions.length
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error("❌ Tag options fetch error:", error);

    return new Response(JSON.stringify({ 
      error: error.message || "Unknown error" 
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
