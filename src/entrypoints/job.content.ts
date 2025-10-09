export default defineContentScript({
  matches: ['*://*.linkedin.com/jobs/*'],
  runAt: 'document_idle',
  main: () => {
    console.log("🚀 LinkedIn job scraper running...");

    let lastJobId: string | null = null;

    function scrapeJobData() {
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

      // Requirements
      // const requirements = Array.from(document.querySelectorAll('.jobs-description__content li'))
      //   .map(li => li.textContent?.replace(/\s+/g, ' ').trim())
      //   .filter(text => text && text.length > 10);
      // const requirementsEL = document.querySelector("jobs-description-content__text--stretch");
      // const description = requirementsEL!.textContent!.trim();


      // Description
      const descriptionEl = document.querySelector('.jobs-description__content');
      const description = descriptionEl?.textContent?.trim() || '';

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
        requirements: [],
        description,
      };
    }

    function checkAndSendData() {
      const rawJobData = scrapeJobData();

      if (rawJobData.company && rawJobData.title && rawJobData.jobId !== lastJobId) {
        lastJobId = rawJobData.jobId;

        console.log('📊 Scraped job data:', rawJobData);

        // Transform to popup-friendly format
        const structuredData = {
          jobData: {
            title: rawJobData.title,
            company: rawJobData.company,
            location: rawJobData.location,
            type: rawJobData.types,
            salary: rawJobData.salary,
            posted: rawJobData.posted,
          },
          requirements: rawJobData.requirements,
          skills: [], // placeholder, can be filled later
        };

        browser.runtime.sendMessage({
          type: 'SCRAPED_DATA',
          data: structuredData,
        });
      }
    }

    // Initial scrape
    checkAndSendData();

    // Observe for job changes
    const observer = new MutationObserver(() => {
      checkAndSendData();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
