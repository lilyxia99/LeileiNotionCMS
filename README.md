This is a Vite project using Notion  Vite, Notion API, Supabase, Aider and Claude API. 

The project couldn't be possible without the tutorial from  [Coding in Public too](https://www.youtube.com/@CodinginPublic), definitely check out their tutorial [here](https://www.youtube.com/watch?v=mukkm6o6Pjw&list=PLoqZcxvpWzzdJiW95Y7nDqY8XsiKTgo17&index=1)

I personally choose to use Notion as a middle ground, because it kind of serve as a What You See Is What You Get (WYSIWYG) layout editor. I don't like the default asethetic of Notion publishing and the current public approaches can't fullfill my need of customization either.

### To duplicate this template

1. Fork this repository into a new repository
2. edit the sample.env, delete the "sample" in its name and make it just called ".env", fill in the NOTION_KEY with your Notion API Key, Notion DB as your Notion Database id

If you want to use this code, You can refer to the fetchNotion.js and getPages.js in functions. Those are the main things that's getting the information in real time from Notion. be aware that these are netlify functions, so I stored the enviornment variables  (like my API keys etc) in netlify itself so that they are not leaked in this repository. Of course you could have your own .env in your repository (I ended up doing that too)

Again please watch the tutorials from Coding in Public. They explained pretty much how netlify functions work in this case and I am basically copying that.

I then have my local function in scirpts, which includes generatePages.js and processNotionImages.js. The first one is to generate each individual pages based on the specific Notion layout I made, and the second is to upload all the images that are using the Notion link to SupaBase, and migrate those link back to Notion to replace the image. Notion image link expires after a certain amount of time, so it's always good to have external link if you want to use Notion as the main source of website builder. For these function I am using environment variables in my .env file. You should generate your own and see what those key variable names are in the script. 

In the future I will make this more accessible (at least the using Notion to generate individual page part) so that everyone can easily modify it. Right now I just don't have time. 

Thank you and enjoy! you can see the result of this website at [www.leileixia.com](https://leileixia.com)
