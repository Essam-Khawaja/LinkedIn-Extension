let latestScraped: any = null;

export default defineBackground(() => {
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPED_DATA') {
      latestScraped = message.data;
      browser.runtime.sendMessage({
        type: 'RELAYED_SCRAPED_DATA',
        data: message.data,
      });
    }

    if (message.type === 'GET_LATEST_SCRAPED') {
      sendResponse(latestScraped);
      return true;
    }
  });
});