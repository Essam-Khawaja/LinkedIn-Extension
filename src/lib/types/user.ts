// lib/types/user.ts

export interface EmploymentEntry {
  id: string;  // Unique identifier
  jobTitle: string;
  company: string;
  startDate: string;  // e.g., "Jan 2020" or "2020-01"
  endDate?: string;  // e.g., "Dec 2022" or empty if current
  isCurrent: boolean;  // Checkbox for current employment
  description?: string;  // Brief description of role/achievements
}

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
  
  // Professional
  yearsExperience: number;
  skills: string[];  // CRITICAL for job matching
  
  // Employment History (Optional - for those with work experience)
  employmentHistory?: EmploymentEntry[];  // Array of jobs
  
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