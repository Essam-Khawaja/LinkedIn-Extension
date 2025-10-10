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


async function analyzeJobWithAI(jobData: any) {
  try {
    // @ts-ignore
    const availability = await LanguageModel.availability();
    console.log('✨ AI Availability:', availability);

    if (availability === 'no') {
      console.warn("❌ Gemini Nano not available");
      return null;
    }

    if (availability === 'after-download') {
      console.log("⏳ Triggering Gemini Nano download...");
      // @ts-ignore
      await LanguageModel.create();
      return null;
    }

    // @ts-ignore
    const session = await LanguageModel.create();

    const description = jobData.description 
      ? jobData.description.substring(0, 1500)
      : 'No description available';

    const schema = {
      type: "object",
      required: ["cleanSummary", "salary", "skills", "requirements"],
      additionalProperties: false,
      properties: {
        cleanSummary: { type: "string" },
        salary: { type: "string" },
        skills: {
          type: "array",
          items: {
            type: "object",
            required: ["name", "match"],
            properties: {
              name: { type: "string" },
              match: { type: "number" },
            },
          },
        },
        requirements: {type: "array",
          items: {
            type: "string",
          }
        }
      },
    };

    const prompt = `Analyze this job posting and extract key information.

Job Details:
- Title: ${jobData.title || 'Unknown'}
- Company: ${jobData.company || 'Unknown'}
- Location: ${jobData.location || 'Not specified'}
- Type: ${jobData.type || 'Not specified'}
- Current Salary: ${jobData.salary || "Not specified"}

Full Description:
${description}

IMPORTANT: Only extract information that is explicitly stated in the description. Do not make up or infer information.

Provide a JSON response with:
1. cleanSummary: A 2-3 sentence concise summary of the role
2. salary: Extract salary as "$XX,XXX - $XX,XXX" or "N/A" if not mentioned
3. requirements: Extract 5-7 key qualifications/requirements (prioritize basic qualifications)
4. skills: Array of 5-7 key technical skills with importance rating (0-100)

Example format:
{
  "cleanSummary": "Software engineer role focusing on...",
  "salary": "$80,000 - $120,000",
  "requirements": ["Bachelor's degree in CS", "3+ years experience"],
  "skills": [{"name": "JavaScript", "match": 90}, {"name": "React", "match": 85}]
}

Return ONLY valid JSON matching this structure.`;

    const result = await session.prompt(prompt);
    console.log("🤖 Raw AI Response:", result);

      let cleanedResult = result.trim();
    
    // Remove ```json and ``` if present
    if (cleanedResult.startsWith('```json')) {
      cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanedResult.startsWith('```')) {
      cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }
    
    const parsed = JSON.parse(cleanedResult);
    
    session.destroy();
    return parsed;

  } catch (err) {
    return null;
  }
}

export default defineBackground(() => {
  console.log('🎯 Background script initialized');

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPED_DATA':
        // Store the scraped data
        const scrapedData = message.data as ScrapedData;
        
        // console.log('Background received job data:', {
        //   company: scrapedData?.jobData.company,
        //   title: scrapedData?.jobData.title,
        //   hasDescription: !!scrapedData?.jobData.description,
        //   descLength: scrapedData?.jobData.description?.length || 0,
        // });

        // Analyze with AI before storing/relaying
        if (scrapedData?.jobData.description && scrapedData.jobData.description.length > 100) {
          console.log('🔄 Starting AI analysis in background...');
          
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
                type: 'RELAYED_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {
                //
              });
            })
            .catch(err => {
              // Use original data on error
              latestScraped = scrapedData;
              
              browser.runtime.sendMessage({
                type: 'RELAYED_SCRAPED_DATA',
                data: latestScraped,
              }).catch(() => {});
            });
        } else {
          // No description or too short, skip AI
          latestScraped = scrapedData;
          
          browser.runtime.sendMessage({
            type: 'RELAYED_SCRAPED_DATA',
            data: latestScraped,
          }).catch(() => {
            //
          });
        }
        break;

      case 'GET_LATEST_SCRAPED':
        // Popup requesting stored data
        sendResponse(latestScraped);
        return true; // Keep channel open for async

      default:
        break;
    }
  });
});