import { analyzeJobWithAI, generateCoverLetter } from '../lib/background-help/job-summarizer'

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
let isProcessing = false;

export default defineBackground(() => {
  console.log('Background script initialized');

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPING_STARTED':
        console.log('SCRAPING_STARTED');
        isProcessing = true;
        
        browser.runtime.sendMessage({
          type: 'SCRAPING_STARTED',
        }).catch(() => {
          console.log('Popup not open');
        });
        break;

      case 'GET_PROFILE': {
        console.log("GET_PROFILE received");
        
        (async () => {
          try {
            const data = await chrome.storage.local.get('profile');
            console.log('Sending profile:', data.profile);
            sendResponse({ ok: true, profile: data.profile });
          } catch (err) {
            console.error("Error in GET_PROFILE:", err);
            sendResponse({ ok: false, error: err!.toString() });
          }
        })();
        return true; // Keep channel open
      }

      case 'JOB_SCRAPED_DATA': {
        const scrapedData = message.data as ScrapedData;
        console.log('📦 JOB_SCRAPED_DATA received');

        if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
          console.log('Starting AI analysis...');
          
          analyzeJobWithAI(scrapedData.jobData)
            .then(aiResult => {
              console.log('AI Result:', aiResult);

              if (aiResult) {
                latestScraped = {
                  jobData: {
                    ...scrapedData.jobData,
                    salary: aiResult.salary || scrapedData.jobData.salary,
                    description: aiResult.cleanSummary || scrapedData.jobData.description,
                  },
                  requirements: aiResult.requirements || [],
                  skills: aiResult.skills || [],
                };
              } else {
                latestScraped = scrapedData;
              }

              isProcessing = false;

              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => console.log('Popup not open'));
            })
            .catch(err => {
              console.error('AI analysis error:', err);
              latestScraped = scrapedData;
              isProcessing = false;
              
              browser.runtime.sendMessage({
                type: 'RELAYED_JOB_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => console.log('Popup not open'));
            });
        } else {
          console.log('Skipping AI (no description)');
          latestScraped = scrapedData;
          isProcessing = false;
          
          browser.runtime.sendMessage({
            type: 'RELAYED_JOB_SCRAPED_DATA',
            data: latestScraped,
          }).catch(() => console.log('Popup not open'));
        }
        break;
      }
      
      case 'GENERATE_COVER_LETTER': {
        console.log('GENERATE_COVER_LETTER request received');
        
        (async () => {
          try {
            // Get user profile
            const { profile } = await chrome.storage.local.get('profile');
            
            if (!profile) {
              sendResponse({ 
                ok: false, 
                error: 'No profile found. Please set up your profile first.' 
              });
              return;
            }

            // Use latest scraped data
            if (!latestScraped) {
              sendResponse({ 
                ok: false, 
                error: 'No job data available. Please open a job posting first.' 
              });
              return;
            }

            console.log('Generating cover letter with:', {
              job: latestScraped.jobData.title,
              user: profile.firstName
            });

            // Generate the cover letter
            const coverLetter = await generateCoverLetter(
              latestScraped.jobData,
              latestScraped,
              {
                name: `${profile.firstName} ${profile.lastName}`,
                email: profile.email,
                phone: profile.phone,
                currentRole: profile.currentTitle,
                yearsExperience: profile.yearsExperience?.toString(),
                skills: [], // You can add skills to profile if needed
                achievements: []
              }
            );

            if (!coverLetter) {
              sendResponse({ 
                ok: false, 
                error: 'Failed to generate cover letter. AI may not be available.' 
              });
              return;
            }

            console.log('Cover letter generated successfully');
            sendResponse({ 
              ok: true, 
              coverLetter: coverLetter 
            });

          } catch (err) {
            console.error('Cover letter generation error:', err);
            sendResponse({ 
              ok: false, 
              error: err!.toString() 
            });
          }
        })();
        
        return true; // Keep channel open for async response
      }

      case 'GET_LATEST_JOB_SCRAPED':
        console.log('Sending data to popup:', { hasData: !!latestScraped, isProcessing });
        sendResponse({ data: latestScraped, isProcessing });
        return true;

      default:
        break;
    }
  });
});