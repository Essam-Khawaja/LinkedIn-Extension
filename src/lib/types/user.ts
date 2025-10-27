// lib/types/user.ts

export default interface UserProfile {
  // Basic Info
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  
  // Location
  address: string;
  city: string;
  state: string;
  zip: string;
  
  // Professional (Required)
  currentTitle: string;
  currentCompany: string;
  yearsExperience: number;
  skills: string[];  // CRITICAL for job matching
  
  // Education & Background
  education?: string;  // e.g., "Bachelor's in Computer Science, MIT, 2018"
  resumeSummary?: string;  // 2-3 paragraphs about experience/achievements
  
  // Certifications & Credentials
  certifications?: string[];  // e.g., ["AWS Certified Solutions Architect", "PMP"]
  
  // Compensation
  salaryExpectation?: string;  // e.g., "$80,000 - $100,000" or "Negotiable"
  
  // Links
  linkedin: string;
  portfolio?: string;
  github?: string;  // Important for tech roles
  
  // Preferences
  needsSponsorship: boolean;
  willingToRelocate: boolean;
}