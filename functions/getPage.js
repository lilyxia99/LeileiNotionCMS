const { Client } = require("@notionhq/client")

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
    const IDs = response.results.map((page)=>page.id)
    const blocks = await notion.blocks.children.list({
      block_id: IDs[0],
      page_size: 100, // You can adjust this if needed
    });
    console.log(blocks);
  return new Response(JSON.stringify(blocks))}
  catch(e){
    console.error(e);
    return new Response(JSON.stringify({statusCode:500,body:e.toString()}))
  }
  
};