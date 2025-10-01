export default defineContentScript({
  matches: ['*://*.linkedin.com/jobs/*'],
  runAt: 'document_idle',
  main: () => {
    console.log("🚀 LinkedIn script running...");

    let lastCompany: any = null;
    const observer = new MutationObserver(() => {
      const card = document.querySelector('.job-details-jobs-unified-top-card__company-name');
      const company = card?.textContent?.trim();

      if (company && company !== lastCompany) {
        lastCompany = company;
        
        browser.runtime.sendMessage({
          type: 'SCRAPED_DATA',
          data: { company },
        });
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  },
});
