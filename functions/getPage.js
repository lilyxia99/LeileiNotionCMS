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
      "or": [
        {
          "property":"Status",
          "status":{
            "equals":"done"
          }
        },
        {
          "property":"Status",
          "status":{
            "equals":"private"
          }
        }
      ]
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
          tag:page.tag,
          type:page.type,
          content: content,
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
