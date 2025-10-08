interface JobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  applicants: string;
  types: string;
  salary: string;
  experience: string;
  requirements: string[];
  description: string;
}

let latestScraped: JobData | null = null;

async function tryAI()
{
  try {
    const availability = await LanguageModel.availability();
    const session = await LanguageModel.create();

    const schema = { type: "string" };
    const post = "Mugs and ramen bowls...";

    const result = await session.prompt(
      `Is this post about pottery?\n\n${post}`,
      { responseConstraint: schema }
    );

    return JSON.parse(result);
  } catch (err) {
    console.error("Error in tryAI:", err);
  }
}

export default defineBackground(() => {
  // Listen for messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPED_DATA':
        // Store the latest scraped job data
        latestScraped = message.data;

        tryAI().then(aiResult => {
          console.log('AI Result:', aiResult); // <-- Add this line to log the result
          if (latestScraped) latestScraped.title = aiResult;
        }).catch(err => {
          console.error('Error in tryAI().then:', err);
        });
        
        console.log('Background: Received job data', {
          company: latestScraped?.company,
          title: latestScraped?.title
        });

        // Relay to popup if it's open
        browser.runtime.sendMessage({
          type: 'RELAYED_SCRAPED_DATA',
          data: latestScraped,
        }).catch(() => {
          // Popup not open, ignore error
        });
        tryAI();
        break;

      case 'GET_LATEST_SCRAPED':
        // Send the latest scraped data to requester
        sendResponse(latestScraped);
        return true; // Keep message channel open for async response

      default:
        break;
    }
  });
});