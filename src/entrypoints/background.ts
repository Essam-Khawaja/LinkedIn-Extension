export default defineBackground(() => {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'SCRAPED_DATA') {
      // Relay the message to the popup or other entrypoints
      browser.runtime.sendMessage({
        type: 'RELAYED_SCRAPED_DATA',
        data: message.data,
      });  
    }
  });
});
