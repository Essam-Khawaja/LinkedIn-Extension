export default defineContentScript({
  matches: ['<all_urls>'], // or specific job sites
  runAt: 'document_idle',
  async main() {
    // This runs automatically on matched pages
    // console.log("Auto-fill script loaded");
    // chrome.runtime.onMessage.addListener((msg) => {
    //   if (msg.action === 'start-auto-fill') {
    //     console.log("✅ Autofill triggered by popup");
    //     // form filling logic here
    //   }
    // });

  },
});
