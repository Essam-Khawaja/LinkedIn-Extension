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

export default defineBackground(() => {
  // Listen for messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPED_DATA':
        // Store the latest scraped job data
        latestScraped = message.data;
        
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