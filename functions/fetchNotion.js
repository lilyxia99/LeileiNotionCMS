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
    console.log("fetched data from Notion");
  return new Response(JSON.stringify(response))}
  catch(e){
    console.error(e);
    return new Response(JSON.stringify({statusCode:500,body:e.toString()}))
  }
  
};
