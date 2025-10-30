"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Download,
  CheckCircle,
  Mail,
  ArrowRight,
  Loader2,
  X,
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  ArrowLeft,
} from "lucide-react";
import { browser } from "wxt/browser";
import checkPage from "@/lib/checkPage";
import {
  createApplication,
  saveApplication,
  applicationExists,
} from "@/lib/utils/applicationStorage";

interface JobData {
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
  description: string;
}

interface Skill {
  name: string;
  match: number;
}

interface ScrapedData {
  jobData: JobData;
  requirements: string[];
  skills: Skill[];
}

export function useContentScriptData() {
  const [onJobsPage, setOnJobsPage] = useState<boolean | null>(null);
  const [scrapedData, setScrapedData] = useState<ScrapedData | null>(null);
  const [dataIsLoaded, setDataIsLoaded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    async function check() {
      const isCorrectPage: boolean = await checkPage("linkedin.com/jobs/");
      setOnJobsPage(isCorrectPage);
    }
    check();

    async function fetchData() {
      try {
        const response = await browser.runtime.sendMessage({
          type: "GET_LATEST_JOB_SCRAPED",
        });

        if (response?.data) {
          setScrapedData(response.data);
          setDataIsLoaded(true);
        }

        setIsUpdating(response?.isProcessing || false);
      } catch (err) {
        console.error("Failed to fetch data:", err);
      }
    }

    fetchData();

    const pollInterval = setInterval(fetchData, 500);

    const handleMessage = (message: any) => {
      if (message?.type === "SCRAPING_STARTED") {
        setIsUpdating(true);
      }

      if (message?.type === "RELAYED_JOB_SCRAPED_DATA" && message.data) {
        setScrapedData(message.data);
        setDataIsLoaded(true);
        setIsUpdating(false);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      clearInterval(pollInterval);
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return { onJobsPage, scrapedData, dataIsLoaded, isUpdating };
}

export default function JobSummarizer() {
  const navigate = useNavigate();
  const { onJobsPage, scrapedData, dataIsLoaded, isUpdating } =
    useContentScriptData();

  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [alreadyExists, setAlreadyExists] = useState(false);

  // Check if application already exists when data loads
  useEffect(() => {
    async function checkExists() {
      if (scrapedData) {
        const exists = await applicationExists(
          scrapedData.jobData.title,
          scrapedData.jobData.company
        );
        setAlreadyExists(exists);
        setIsSaved(exists);
      }
    }
    checkExists();
  }, [scrapedData]);

  async function handleGenerateCoverLetter() {
    setIsGenerating(true);
    setShowCoverLetter(true);
    setError(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_COVER_LETTER",
      });

      console.log("Cover letter response:", response);

      if (response?.ok && response.coverLetter) {
        setCoverLetter(response.coverLetter);
        setError(null);
      } else {
        setError(response?.error || "Failed to generate cover letter");
        setCoverLetter(null);
      }
    } catch (error) {
      console.error("Error generating cover letter:", error);
      setError("Failed to generate cover letter. Check console for details.");
      setCoverLetter(null);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleCopyCoverLetter() {
    if (coverLetter) {
      navigator.clipboard.writeText(coverLetter);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  }

  function handleDownloadCoverLetter() {
    if (!coverLetter) return;

    const blob = new Blob([coverLetter], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cover-letter-${scrapedData?.jobData.company || "job"}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function handleSaveApplication() {
    if (!scrapedData || alreadyExists) return;

    setIsSaving(true);
    try {
      // Get current URL
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      const jobUrl = tab?.url;

      const application = createApplication(
        scrapedData.jobData.title,
        scrapedData.jobData.company,
        scrapedData.jobData.location,
        scrapedData.jobData.salary !== "N/A"
          ? scrapedData.jobData.salary
          : undefined,
        jobUrl
      );

      await saveApplication(application);
      setIsSaved(true);
      setAlreadyExists(true);

      // Don't reset - keep it saved
    } catch (error) {
      console.error("Failed to save application:", error);
    } finally {
      setIsSaving(false);
    }
  }

  if (!onJobsPage) {
    return (
      <div className="extension-popup dark bg-black">
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <h1 className="text-3xl text-center font-bold p-4">
              Go to Jobs Page to Access Feature
            </h1>
            <Button
              onClick={() =>
                chrome.tabs.create({
                  url: "https://www.linkedin.com/jobs/collections",
                })
              }
              className="w-full cursor-pointer"
              variant="outline"
            >
              Go to Jobs Page
              <ArrowRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!dataIsLoaded || !scrapedData) {
    return (
      <div className="extension-popup dark bg-black">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <CardTitle className="text-base">Loading job data...</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <LoadingSkeleton />
          </CardContent>
        </Card>
      </div>
    );
  }

  const jobData = scrapedData.jobData;
  const requirements = scrapedData.requirements || [];
  const skills = scrapedData.skills || [];

  // Calculate average skill match if skills exist
  const avgMatch =
    skills.length > 0
      ? Math.round(skills.reduce((acc, s) => acc + s.match, 0) / skills.length)
      : 0;

  // Show cover letter view if active
  if (showCoverLetter) {
    return (
      <div className="extension-popup dark bg-black">
        <Card className="w-full max-w-md shadow-lg border-primary/20">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary" />
                <CardTitle className="text-base">Cover Letter</CardTitle>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCoverLetter(false);
                  setCoverLetter(null);
                  setError(null);
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            <CardDescription className="text-xs">
              {jobData.title} at {jobData.company}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs">{error}</AlertDescription>
              </Alert>
            )}

            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating your personalized cover letter...
                </p>
                <p className="text-xs text-muted-foreground">
                  This may take 10-30 seconds
                </p>
              </div>
            ) : coverLetter ? (
              <>
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="min-h-[350px] text-xs font-mono"
                  placeholder="Your cover letter will appear here..."
                />
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={handleCopyCoverLetter}
                  >
                    {copySuccess ? (
                      <>
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>Copy to Clipboard</>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadCoverLetter}
                  >
                    <Download className="w-3 h-3 mr-1" />
                    Download
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCoverLetter(false)}
                  >
                    Back
                  </Button>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main job summary view
  return (
    <div className="extension-popup dark bg-black">
      <Card className="w-full max-w-md shadow-lg border-primary/20">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/")}
                className="h-8 w-8 p-0"
              >
                <ArrowLeft className="w-4 h-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  Job Analysis
                </CardTitle>
                {/* <CardDescription className="text-xs">
                  AI-powered job analysis with skill matching
                </CardDescription> */}
              </div>
            </div>
            <Badge
              variant={isUpdating ? "outline" : "secondary"}
              className="text-xs"
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Analyzed
                </>
              )}
            </Badge>
          </div>
        </CardHeader>

        <CardContent
          className={`space-y-4 transition-opacity duration-200 ${
            isUpdating ? "opacity-50 pointer-events-none" : ""
          }`}
        >
          {/* Primary Actions at Top */}
          <div className="space-y-2">
            <Button
              size="sm"
              className="w-full"
              onClick={handleGenerateCoverLetter}
              disabled={isUpdating || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Generating Cover Letter...
                </>
              ) : (
                <>
                  <Mail className="w-3 h-3 mr-1" />
                  Generate Cover Letter
                </>
              )}
            </Button>

            <Button
              size="sm"
              variant={isSaved ? "secondary" : "outline"}
              className="w-full"
              onClick={handleSaveApplication}
              disabled={isUpdating || isSaving || alreadyExists}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Saving...
                </>
              ) : alreadyExists ? (
                <>
                  <BookmarkCheck className="w-3 h-3 mr-1" />
                  Already Saved
                </>
              ) : (
                <>
                  <Bookmark className="w-3 h-3 mr-1" />
                  Save to Applications
                </>
              )}
            </Button>
          </div>

          <Separator />

          {/* Job Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{jobData.title}</h3>
            <p className="text-xs text-primary font-medium">
              {jobData.company}
            </p>
            <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                {jobData.location}
              </div>
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {jobData.type}
              </div>
              <div className="flex items-center gap-1">
                <DollarSign className="w-3 h-3" />
                {jobData.salary || "N/A"}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {jobData.posted}
              </div>
            </div>
          </div>

          <Separator />

          {/* Overall Match Score */}
          {skills.length > 0 && (
            <>
              <div className="space-y-2 bg-secondary/50 p-3 rounded-lg">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-sm">Overall Match</h4>
                  <span className="text-2xl font-bold text-primary">
                    {avgMatch}%
                  </span>
                </div>
                <div className="w-full bg-secondary rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full transition-all duration-300"
                    style={{ width: `${avgMatch}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Based on your profile skills vs job requirements
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Key Requirements */}
          {requirements.length > 0 && (
            <>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Key Requirements</h4>
                <div className="space-y-1.5">
                  {requirements.map((req: string, index: number) => (
                    <div key={index} className="flex items-start gap-2 text-xs">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full mt-1.5 flex-shrink-0" />
                      <span>{req}</span>
                    </div>
                  ))}
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Skill Match */}
          {skills.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Skill Breakdown</h4>
              <div className="space-y-2">
                {skills.map((skill: { name: string; match: number }) => (
                  <div key={skill.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">{skill.name}</span>
                      <span
                        className={`${
                          skill.match >= 80
                            ? "text-green-500"
                            : skill.match >= 50
                            ? "text-yellow-500"
                            : "text-red-500"
                        }`}
                      >
                        {skill.match}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                          skill.match >= 80
                            ? "bg-green-500"
                            : skill.match >= 50
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{ width: `${skill.match}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <>
      <div className="space-y-2">
        <div className="h-4 bg-secondary rounded animate-pulse w-3/4" />
        <div className="grid grid-cols-2 gap-2">
          <div className="h-3 bg-secondary rounded animate-pulse" />
          <div className="h-3 bg-secondary rounded animate-pulse" />
          <div className="h-3 bg-secondary rounded animate-pulse" />
          <div className="h-3 bg-secondary rounded animate-pulse" />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
        <div className="space-y-1">
          <div className="h-3 bg-secondary rounded animate-pulse" />
          <div className="h-3 bg-secondary rounded animate-pulse" />
          <div className="h-3 bg-secondary rounded animate-pulse" />
        </div>
      </div>

      <Separator />

      <div className="space-y-2">
        <div className="h-3 bg-secondary rounded animate-pulse w-1/2" />
        <div className="space-y-2">
          <div className="h-2 bg-secondary rounded animate-pulse" />
          <div className="h-2 bg-secondary rounded animate-pulse" />
          <div className="h-2 bg-secondary rounded animate-pulse" />
        </div>
      </div>
    </>
  );
}
