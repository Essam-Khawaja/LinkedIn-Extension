import analyzeJobWithAI from "@/lib/background-help/job-summarizer";

interface Skill {
  name: string;
  match: number;
}

interface JobData {
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
  description: string;
}

interface ScrapedData {
  jobData: JobData;
  requirements: string[];
  skills: Skill[];
}

let latestScraped: ScrapedData | null = null;

export default defineBackground(() => {
  console.log('🎯 Background script initialized');

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'JOB_SCRAPED_DATA':
        // Store the scraped data
        const scrapedData = message.data as ScrapedData;

        if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
          // console.log('🔄 Starting AI analysis in background...');
          
          analyzeJobWithAI(scrapedData.jobData)
            .then(aiResult => {
              console.log('AI Result:', aiResult);

              if (aiResult) {
                // Enrich the data with AI results
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary,
                  },
                  requirements: aiResult.requirements || scrapedData.requirements || [],
                  skills: aiResult.skills || [],
                };
              } else {
                // AI failed, use original data
                latestScraped = scrapedData;
              }

              // Relay enriched data to popup
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {
                //
              });
            })
            .catch(err => {
              // Use original data on error
              latestScraped = scrapedData;
              
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {});
            });
        } else {
          // No description or too short, skip AI
          latestScraped = scrapedData;
          
          browser.runtime.sendMessage({
            type: 'RELAYED_JOB_SCRAPED_DATA',
            data: latestScraped,
          }).catch(() => {
            //
          });
        }
        break;
      
      case 'SCRAPING_STARTED':
        browser.runtime.sendMessage({
            type: 'SCRAPING_STARTED',
          }).catch(() => {
            //
          });
        break;

      case 'PROFILE_SCRAPED_DATA':
        console.log('Background receiving content script call')
        break;

      case 'GET_LATEST_JOB_SCRAPED':
        // Popup requesting stored data
        sendResponse(latestScraped);
        return true; // Keep channel open for async

      default:
        break;
    }
  });
});