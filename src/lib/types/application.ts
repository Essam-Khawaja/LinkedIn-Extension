export interface Application {
  id: string; // Unique ID (timestamp-based)
  jobTitle: string;
  company: string;
  location: string;
  salary?: string;
  appliedDate: string; // ISO date string
  status: 'pending' | 'viewed' | 'interviewing' | 'rejected' | 'accepted';
  jobUrl?: string; // LinkedIn URL
  notes?: string;
}

export interface ApplicationStats {
  total: number;
  thisWeek: number;
  thisMonth: number;
  byStatus: {
    pending: number;
    viewed: number;
    interviewing: number;
    rejected: number;
    accepted: number;
  };
}