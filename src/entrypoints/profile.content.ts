export default defineContentScript({
    matches: ['*://*.linkedin.com/in/*'],
    runAt: 'document_idle',
    main: () => {
        console.log('Hey! Im running!')

        let isProcessing = false;

        async function scrapeJobData(){
            console.log('Scraping data...')
            return null;
        }

        async function checkAndSendData(){
            console.log('Sending data...')
            const rawData = await scrapeJobData();

        browser.runtime.sendMessage({
            type: 'PROFILE_SCRAPED_DATA',
            data: rawData,
            }).then(() => {
            console.log('Data sent to background');
            }).catch((err) => {
            console.error('Failed to send data:', err);
            }).finally(() => {
            isProcessing = false;
        });
        }

        // Initial scrape with delay
        setTimeout(checkAndSendData, 1500);

        // Observe for job changes with debounce
        let debounceTimer: any;
        const observer = new MutationObserver(() => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(checkAndSendData, 800);
        });

        observer.observe(document.body, {
        childList: true,
        subtree: true,
        });
  }, 
});