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


export default async function analyzeJobWithAI(jobData: any) {
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

    const result = await session.prompt(prompt, {responseConstraint: schema});
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