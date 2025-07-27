import { Client } from "@notionhq/client";

const{NOTION_KEY,NOTION_DB} = process.env;

// Initializing a client
const notion = new Client({
  auth: NOTION_KEY,
})

export default async (req, context) => {
  try{const response = await notion.databases.query({
    database_id: NOTION_DB,
    filter:{
      "property":"Status",
      "status":{
        "equals":"done"
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

    // Fetch content for each page
    const pagesWithContent = await Promise.all(
      pages.map(async (page) => {
        const blocks = await notion.blocks.children.list({
          block_id: page.id,
          page_size: 100,
        });
        return {
          page_id: page.id,
          title: page.Name,
          slug: page.slug,
          description: page.description,
          titleImage: page.titleImage,
          content: blocks.results,
        };
      })
    );

    return new Response(JSON.stringify(pagesWithContent), {
      headers: { "Content-Type": "application/json" },
    });
  } catch(e){
    console.error(e);
    return new Response(JSON.stringify({statusCode:500,body:e.toString()}))
  }
  
};
