let latestScraped: {
  jobData?: any;
  requirements?: string[];
  skills?: { name: string; match: number }[];
} | null = null;

export default defineBackground(() => {
  // Listen for messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPED_DATA':
        // Store the latest data
        latestScraped = message.data;

        // Relay to other listeners (optional, e.g., popup)
        browser.runtime.sendMessage({
          type: 'RELAYED_SCRAPED_DATA',
          data: latestScraped,
        });
        break;

      case 'GET_LATEST_SCRAPED':
        // Respond with the latest scraped data
        sendResponse(latestScraped);
        return true; // indicates async response support

      default:
        break;
    }
  });
});
