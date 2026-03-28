import { Client } from "@notionhq/client";


export default async (req) => {
  try {
    const { NOTION_KEY, NOTION_DB } = process.env;

    if (!NOTION_KEY || !NOTION_DB) {
      throw new Error("Missing NOTION_KEY or NOTION_DB environment variable");
    }

    const notion = new Client({ auth: NOTION_KEY });

    const response = await notion.databases.query({
      database_id: NOTION_DB,
      filter: {
        property: "Status",
        status: {
          equals: "done"
        }
      },
      sorts: [
        {
          property: "ordering",
          direction: "ascending"
        }
      ]
    });

    console.log("✅ Fetched data from Notion");

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  } catch (error) {
    console.error("❌ Notion fetch error:", error);

    return new Response(JSON.stringify({ error: error.message || "Unknown error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
};
