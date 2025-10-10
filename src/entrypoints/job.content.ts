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
        return;
      }
      
      const rawJobData = await scrapeJobData();

      if (rawJobData.company && rawJobData.title && rawJobData.jobId !== lastJobId) {
        isProcessing = true;
        lastJobId = rawJobData.jobId;

        // console.log('Scraped job data:', {
        //   title: rawJobData.title,
        //   company: rawJobData.company,
        //   hasDescription: !!rawJobData.description,
        //   descLength: rawJobData.description?.length || 0,
        // });

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

        // console.log('Sending data to background:', structuredData);

        // Send to background
        browser.runtime.sendMessage({
          type: 'JOB_SCRAPED_DATA',
          data: structuredData,
        }).then(() => {
          console.log('Data sent to background');
        }).catch((err) => {
          console.error('Failed to send data:', err);
        }).finally(() => {
          isProcessing = false;
        });
      }
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