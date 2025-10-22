export default interface User{
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
}
