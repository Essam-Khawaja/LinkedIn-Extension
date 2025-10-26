interface Skill {
  name: string;
  match: number;
}

export default defineContentScript({
  matches: ['*://*.linkedin.com/jobs/*'],
  runAt: 'document_idle',
  main: () => {
    console.log("🚀 LinkedIn job scraper running...");
    console.log("📍 Current URL:", window.location.href);
    console.log("📍 Page title:", document.title);

    let lastJobId: string | null = null;
    let isProcessing = false;

    async function scrapeJobData() {
      // Job title
      const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1');
      const title = titleEl?.textContent?.trim() || '';

      // Company
      const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
      const company = companyEl?.textContent?.trim() || '';

      // Metadata
      const metadataSpans = document.querySelectorAll(
        '.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text'
      );
      const location = metadataSpans[0]?.textContent?.trim() || '';
      const posted = metadataSpans[2]?.querySelector('span')?.textContent?.trim() || '';
      const applicants = metadataSpans[4]?.textContent?.trim() || '';

      // Job type badges
      const typeBadges = Array.from(
        document.querySelectorAll('.job-details-fit-level-preferences button strong')
      )
        .map(el => el.textContent?.trim())
        .filter(Boolean);

      // Description
      let description = '';
      const oldSelector = document.querySelector('.jobs-description__content');
        description = oldSelector?.textContent.trim() || '';
      
      // Salary extraction
      const salaryPatterns = [
        /\$[\d,]+(?:\.\d{2})?\s*-\s*\$[\d,]+(?:\.\d{2})?\s*(?:CAD|USD|per hour)?/gi,
        /\$?[\d,]+k\s*-\s*\$?[\d,]+k/gi,
      ];
      let salary = '';
      for (const pattern of salaryPatterns) {
        const match = description.match(pattern);
        if (match) {
          salary = match[0];
          break;
        }
      }

      // Experience level
      const experiencePattern = /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi;
      const expMatch = description.match(experiencePattern);
      const experience = expMatch ? expMatch[0] : '';

      // Unique job ID
      const jobId = `${company}-${title}`;
      return {
        jobId,
        title,
        company,
        location,
        posted,
        applicants,
        types: typeBadges.join(', '),
        salary,
        experience,
        description,
      };
    }

    async function checkAndSendData() {
      if (isProcessing) {
        console.log('⏸️ Already processing, skipping...');
        return;
      }
      
      const rawJobData = await scrapeJobData();

      // Check if we have valid data and if it's different from last job
      const hasValidData = rawJobData.company && rawJobData.title && rawJobData.description && rawJobData.description.length > 100;
      const isNewJob = rawJobData.jobId !== lastJobId;

      // console.log('🔍 Check results:', {
      //   jobId: rawJobData.jobId,
      //   lastJobId: lastJobId,
      //   hasValidData,
      //   isNewJob,
      //   descLength: rawJobData.description?.length || 0
      // });

      if (!hasValidData) {
        console.log('⏳ Incomplete data, waiting for page to load...');
        return;
      }

      if (!isNewJob) {
        console.log('🔄 Same job, no update needed');
        return;
      }

      // New job detected - start processing
      console.log('New job detected:', rawJobData.jobId);
      isProcessing = true;

      // Send loading state FIRST
      // console.log('Sending SCRAPING_STARTED');
      browser.runtime.sendMessage({
        type: 'SCRAPING_STARTED'
      }).catch(err => console.log('Popup may not be open'));

      // Small delay to ensure loading state is processed
      await new Promise(resolve => setTimeout(resolve, 100));

      // Create the data structure that background/popup expects
      const structuredData = {
        jobData: {
          title: rawJobData.title,
          company: rawJobData.company,
          location: rawJobData.location,
          type: rawJobData.types,
          salary: rawJobData.salary || 'N/A',
          posted: rawJobData.posted,
          description: rawJobData.description,
        },
        requirements: [],
        skills: [],
      };

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.action === "start-cover-letter") {
        // Send actual data
        browser.runtime.sendMessage({
          type: 'GENERATE_COVER',
          data: structuredData,
        }).then(() => {
          console.log('Data sent to background successfully');
        }).catch((err) => {
          console.error('Failed to send data:', err);
        }).finally(() => {
          lastJobId = rawJobData.jobId;
          isProcessing = false;
        });
    }
  });

      // Send actual data
      browser.runtime.sendMessage({
        type: 'JOB_SCRAPED_DATA',
        data: structuredData,
      }).then(() => {
        console.log('Data sent to background successfully');
      }).catch((err) => {
        console.error('Failed to send data:', err);
      }).finally(() => {
        // ALWAYS update lastJobId after processing, regardless of success
        lastJobId = rawJobData.jobId;
        isProcessing = false;
      });
    }

    // Initial scrape with delay
    setTimeout(checkAndSendData, 1500);

    // Observe for job changes with debounce
    let debounceTimer: any;
    const observer = new MutationObserver(() => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(checkAndSendData, 500);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});