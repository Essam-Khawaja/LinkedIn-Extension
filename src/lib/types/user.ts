export default interface UserProfile{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    linkedin?: string;
    currentCompany?: string;
    currentTitle?: string;
    yearsExperience?: number;
    needsSponsorship?: boolean;
    willingToRelocate?: boolean;
    state: string;
    city: string;
    zip: string;
    address: string;
    portfolio: string;
}
