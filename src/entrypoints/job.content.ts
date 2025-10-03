export default defineContentScript({
  matches: ['*://*.linkedin.com/jobs/*'],
  runAt: 'document_idle',
  main: () => {
    console.log("🚀 LinkedIn job scraper running...");
    
    let lastJobId: string | null = null;

    function scrapeJobData() {
      // Get job title
      const titleEl = document.querySelector('.job-details-jobs-unified-top-card__job-title h1');
      const title = titleEl?.textContent?.trim() || '';

      // Get company name
      const companyEl = document.querySelector('.job-details-jobs-unified-top-card__company-name a');
      const company = companyEl?.textContent?.trim() || '';

      // Get metadata (location, posted date, applicants)
      const metadataSpans = document.querySelectorAll('.job-details-jobs-unified-top-card__tertiary-description-container .tvm__text');
      const location = metadataSpans[0]?.textContent?.trim() || '';
      const posted = metadataSpans[2]?.querySelector('span')?.textContent?.trim() || '';
      const applicants = metadataSpans[4]?.textContent?.trim() || '';

      // Get job type badges (Hybrid, Full-time, Internship, etc.)
      const typeBadges = Array.from(document.querySelectorAll('.job-details-fit-level-preferences button strong'))
        .map(el => el.textContent?.trim())
        .filter(Boolean);

      // Get requirements (all list items in description)
      const requirements = Array.from(document.querySelectorAll('.jobs-description__content li'))
        .map(li => li.textContent?.replace(/\s+/g, ' ').trim())
        .filter(text => text && text.length > 10);

      // Get full description text for regex extraction
      const descriptionEl = document.querySelector('.jobs-box__html-content');
      const description = descriptionEl?.textContent?.trim() || '';

      // Extract salary using regex
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

      // Extract experience level
      const experiencePattern = /(\d+)\+?\s*years?\s+(?:of\s+)?experience/gi;
      const expMatch = description.match(experiencePattern);
      const experience = expMatch ? expMatch[0] : '';

      // Create unique job ID (to detect when user switches jobs)
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
        requirements,
        description,
      };
    }

    function checkAndSendData() {
      const jobData = scrapeJobData();
      
      // Only send if we have core data and it's a new job
      if (jobData.company && jobData.title && jobData.jobId !== lastJobId) {
        lastJobId = jobData.jobId;
        
        console.log('📊 Scraped job data:', jobData);
        
        browser.runtime.sendMessage({
          type: 'SCRAPED_DATA',
          data: jobData,
        });
      }
    }

    // Initial scrape
    checkAndSendData();

    // Watch for job changes (when user clicks a different job)
    const observer = new MutationObserver(() => {
      checkAndSendData();
    });

    observer.observe(document.body, { 
      childList: true, 
      subtree: true 
    });
  },
});