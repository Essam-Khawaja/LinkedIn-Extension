import UserProfile from "@/lib/types/user";

interface JobData {
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
  description: string;
}

interface ProfileMatchResult {
  score: number; // 0-100
  checks: {
    hasRelevantExperience: boolean;
    meetsEducation: boolean;
    locationMatch: boolean;
    hasKeySkills: { found: number; total: number };
  };
  strengths: string[]; // Things that make you a good fit
}

export function calculateProfileMatch(
  jobData: JobData,
  requirements: string[],
  skills: { name: string; match: number }[],
  profile?: UserProfile
): ProfileMatchResult {
  if (!profile) {
    return {
      score: 0,
      checks: {
        hasRelevantExperience: false,
        meetsEducation: false,
        locationMatch: false,
        hasKeySkills: { found: 0, total: 0 },
      },
      strengths: [],
    };
  }

  const checks = {
    hasRelevantExperience: checkRelevantExperience(jobData, profile),
    meetsEducation: checkEducation(requirements, profile),
    locationMatch: checkLocation(jobData.location, profile),
    hasKeySkills: checkSkills(skills, profile),
  };

  // Calculate score based on checks
  let score = 0;
  if (checks.hasRelevantExperience) score += 30;
  if (checks.meetsEducation) score += 25;
  if (checks.locationMatch) score += 15;
  
  // Skill score: up to 30 points based on skill coverage
  const skillPercentage = checks.hasKeySkills.total > 0 
    ? checks.hasKeySkills.found / checks.hasKeySkills.total 
    : 0;
  score += Math.round(skillPercentage * 30);

  const strengths = generateStrengths(jobData, profile, checks);

  return {
    score: Math.min(100, score),
    checks,
    strengths,
  };
}

function checkRelevantExperience(jobData: JobData, profile: UserProfile): boolean {
  // Check if user has employment history
  if (!profile.employmentHistory || profile.employmentHistory.length === 0) {
    return false;
  }

  // Check if any job titles are similar or if they have sufficient years of experience
  const jobTitleLower = jobData.title.toLowerCase();
  const hasRelatedTitle = profile.employmentHistory.some(job => 
    job.jobTitle.toLowerCase().includes(jobTitleLower.split(' ')[0]) ||
    jobTitleLower.includes(job.jobTitle.toLowerCase().split(' ')[0])
  );

  // Extract years requirement from job description
  const yearsMatch = jobData.description.match(/(\d+)\+?\s*years?/i);
  const requiredYears = yearsMatch ? parseInt(yearsMatch[1]) : 0;
  const hasEnoughExperience = profile.yearsExperience >= requiredYears;

  return hasRelatedTitle || hasEnoughExperience;
}

function checkEducation(requirements: string[], profile: UserProfile): boolean {
  if (!profile.education) return false;

  const educationLower = profile.education.toLowerCase();
  
  // Check if any requirement mentions degree and if user has it
  const degreeRequired = requirements.some(req => 
    req.toLowerCase().includes('degree') || 
    req.toLowerCase().includes('bachelor') ||
    req.toLowerCase().includes('master') ||
    req.toLowerCase().includes('phd')
  );

  if (!degreeRequired) return true; // No specific requirement

  // Check if user has relevant degree
  return educationLower.includes('bachelor') || 
         educationLower.includes('master') || 
         educationLower.includes('phd') ||
         educationLower.includes('degree');
}

function checkLocation(jobLocation: string, profile: UserProfile): boolean {
  const jobLower = jobLocation.toLowerCase();
  const userCity = profile.city?.toLowerCase() || '';
  const userState = profile.state?.toLowerCase() || '';

  // Remote jobs always match
  if (jobLower.includes('remote')) return true;

  // Check if willing to relocate
  if (profile.willingToRelocate) return true;

  // Check if location matches
  return jobLower.includes(userCity) || jobLower.includes(userState);
}

function checkSkills(
  jobSkills: { name: string; match: number }[],
  profile: UserProfile
): { found: number; total: number } {
  if (!profile.skills || profile.skills.length === 0) {
    return { found: 0, total: jobSkills.length };
  }

  const userSkillsLower = profile.skills.map(s => s.toLowerCase());
  let found = 0;

  jobSkills.forEach(jobSkill => {
    const jobSkillLower = jobSkill.name.toLowerCase();
    const hasSkill = userSkillsLower.some(userSkill => 
      userSkill.includes(jobSkillLower) || 
      jobSkillLower.includes(userSkill)
    );
    if (hasSkill) found++;
  });

  return { found, total: jobSkills.length };
}

function generateStrengths(
  jobData: JobData,
  profile: UserProfile,
  checks: ProfileMatchResult['checks']
): string[] {
  const strengths: string[] = [];

  // Experience strength
  if (profile.yearsExperience > 0) {
    strengths.push(`${profile.yearsExperience} years of professional experience`);
  }

  // Recent relevant role
  if (profile.employmentHistory && profile.employmentHistory.length > 0) {
    const mostRecent = profile.employmentHistory[0];
    if (mostRecent.isCurrent) {
      strengths.push(`Currently working as ${mostRecent.jobTitle}`);
    } else {
      strengths.push(`Previous experience as ${mostRecent.jobTitle}`);
    }
  }

  // Education
  if (profile.education) {
    strengths.push(profile.education);
  }

  // Certifications
  if (profile.certifications && profile.certifications.length > 0) {
    if (profile.certifications.length === 1) {
      strengths.push(`Certified: ${profile.certifications[0]}`);
    } else {
      strengths.push(`${profile.certifications.length} professional certifications`);
    }
  }

  // Skills match
  if (checks.hasKeySkills.found > 0) {
    strengths.push(`${checks.hasKeySkills.found}/${checks.hasKeySkills.total} required skills in profile`);
  }

  // Location
  if (checks.locationMatch) {
    if (jobData.location.toLowerCase().includes('remote')) {
      strengths.push('Open to remote work');
    } else if (profile.willingToRelocate) {
      strengths.push('Willing to relocate');
    } else {
      strengths.push('Local candidate');
    }
  }

  return strengths.slice(0, 4); // Return top 4 strengths
}