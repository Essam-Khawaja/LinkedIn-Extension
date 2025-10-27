"use client";

import { useEffect, useState } from "react";
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
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Copy,
  Download,
  CheckCircle,
  Mail,
  ArrowRight,
  Loader2,
  X,
} from "lucide-react";
import { browser } from "wxt/browser";
import checkPage from "@/lib/checkPage";

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
  const { onJobsPage, scrapedData, dataIsLoaded, isUpdating } =
    useContentScriptData();

  const [coverLetter, setCoverLetter] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showCoverLetter, setShowCoverLetter] = useState(false);
  const [copySuccess, setCopySuccess] = useState(false);

  async function handleGenerateCoverLetter() {
    setIsGenerating(true);
    setShowCoverLetter(true);

    try {
      const response = await chrome.runtime.sendMessage({
        type: "GENERATE_COVER_LETTER",
      });

      console.log("Cover letter response:", response);

      if (response?.ok && response.coverLetter) {
        setCoverLetter(response.coverLetter);
      } else {
        alert(response?.error || "Failed to generate cover letter");
        setShowCoverLetter(false);
      }
    } catch (error) {
      console.error("Error generating cover letter:", error);
      alert("Failed to generate cover letter. Check console for details.");
      setShowCoverLetter(false);
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
            {isGenerating ? (
              <div className="flex flex-col items-center justify-center py-8 space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  Generating your personalized cover letter...
                </p>
              </div>
            ) : coverLetter ? (
              <>
                <Textarea
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                  className="min-h-[300px] text-xs font-mono"
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
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy to Clipboard
                      </>
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowCoverLetter(false)}
                  >
                    Back to Summary
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
            <div className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                Job Analysis
              </CardTitle>
              <CardDescription className="text-xs">
                AI-powered job post summary
              </CardDescription>
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
          {/* Job Info */}
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{jobData.title}</h3>
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

          {/* Key Requirements */}
          {requirements.length > 0 && (
            <>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Key Requirements</h4>
                <div className="space-y-1">
                  {requirements.map((req: string, index: number) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 text-xs"
                    >
                      <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                      {req}
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
              <h4 className="font-medium text-sm">Your Skill Match</h4>
              <div className="space-y-2">
                {skills.map((skill: { name: string; match: number }) => (
                  <div key={skill.name} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span>{skill.name}</span>
                      <span className="text-muted-foreground">
                        {skill.match}%
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-1.5">
                      <div
                        className="bg-primary h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${skill.match}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              size="sm"
              className="flex-1"
              onClick={handleGenerateCoverLetter}
              disabled={isUpdating || isGenerating}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Mail className="w-3 h-3 mr-1" />
                  Generate Cover Letter
                </>
              )}
            </Button>
            <Button size="sm" variant="outline" disabled={isUpdating}>
              <Copy className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" disabled={isUpdating}>
              <Download className="w-3 h-3" />
            </Button>
          </div>
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
