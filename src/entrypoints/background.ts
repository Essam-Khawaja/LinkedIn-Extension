interface Skill {
  name: string;
  match: number;
}

interface JobData {
  jobId: string;
  title: string;
  company: string;
  location: string;
  posted: string;
  applicants: string;
  types: string;
  salary: string;
  experience: string;
  requirements: string[];
  description: string;
  skills: Skill[];
}

interface ScrapedData {
  jobData: JobData;
  requirements: string[];
  skills: Skill[];
}

let latestScraped: JobData | null = null;

async function tryAI(jobData: JobData) {
  try {
    // Check if Gemini Nano is available
    // @ts-ignore
    const availability = await LanguageModel.availability();

    if (availability === 'no') {
      console.warn("Gemini Nano not available.");
      return null;
    }

    // Create session
    // @ts-ignore
    const session = await LanguageModel.create();

    // Define schema for structured output
    const schema = {
      type: "object",
      required: ["cleanSummary", "salary", "skills"],
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

    // Create prompt
        const requirements = Array.isArray(jobData.requirements) 
      ? jobData.requirements.slice(0, 10).join('\n- ')
      : 'Not specified';
    
    const description = jobData.description 
      ? jobData.description.substring(0, 1500)
      : 'No description available';
    const prompt = `
You are analyzing a job posting. Extract key information and provide a structured response.

Job Details:
- Title: ${jobData.title || 'Unknown'}
- Company: ${jobData.company || 'Unknown'}
- Location: ${jobData.location || 'Not specified'}
- Type: ${jobData.types || 'Not specified'}
- Current Salary Info: ${jobData.salary || "Not specified"}
- Experience: ${jobData.experience || "Not specified"}
- Posted: ${jobData.posted || 'Recently'}

Requirements:
None right now, use the description text below to figure it out.

Description:
${description}

Please provide:
1. A concise 2-3 sentence summary (cleanSummary)
2. Extracted salary information in format "$XX,XXX - $XX,XXX" or "N/A" if not found (salary)
3. Top 5-7 technical skills required with match percentage 0-100 (skills)
4. Update the requirements to a max of 5-7, and always include the basic qualifications or job requirements as first priority! (requirements)

Always return a valid JSON response according to the schema.
`;

const testPrompt = "Hey, reply with a 'Yes' in all the fields for now if you can read this"

    // Get AI response
    const result = await session.prompt(prompt, { 
      responseConstraint: schema 
    });

    // Parse and return
    const parsed = JSON.parse(result);
    console.log("AI Analysis Result:", parsed);
    
    // Destroy session to free resources
    session.destroy();
    
    return parsed;

  } catch (err) {
    console.error("Error in tryAI:", err);
    return null;
  }
}
export default defineBackground(() => {
  // Listen for messages from content scripts or popup
  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'SCRAPED_DATA':
        // Store the latest scraped job data
        latestScraped = message.data;

        console.log('Description: ', latestScraped?.description);

        tryAI(latestScraped!).then(aiResult => {
        console.log("AI Result:", aiResult);

        if (latestScraped && aiResult) {
          latestScraped = {
            ...latestScraped,
            // aiSummary: aiResult.cleanSummary,
            requirements: aiResult.requirements,
            salary: aiResult.salary || latestScraped.salary,
            skills: aiResult.skills || [],
          };
        }

  // Now relay the enriched data
  browser.runtime.sendMessage({
    type: "RELAYED_SCRAPED_DATA",
    data: latestScraped,
  }).catch(() => {
    // Popup not open, ignore error
  });
}).catch(err => {
  console.error("Error in tryAI:", err);
});

        
        console.log('Background: Received job data', {
          company: latestScraped?.company,
          title: latestScraped?.title
        });

        // Relay to popup if it's open
        browser.runtime.sendMessage({
          type: 'RELAYED_SCRAPED_DATA',
          data: latestScraped,
        }).catch(() => {
          // Popup not open, ignore error
        });
        break;

      case 'GET_LATEST_SCRAPED':
        // Send the latest scraped data to requester
        sendResponse(latestScraped);
        return true; // Keep message channel open for async response

      default:
        break;
    }
  });
});