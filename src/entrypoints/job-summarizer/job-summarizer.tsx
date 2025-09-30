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
import {
  Briefcase,
  MapPin,
  Clock,
  DollarSign,
  Star,
  Copy,
  Download,
  Sparkles,
  CheckCircle,
  Mail,
  ArrowRight,
} from "lucide-react";
import { browser } from "wxt/browser";

interface JobData {
  title: string;
  company: string;
  location: string;
  type: string;
  salary: string;
  posted: string;
}

interface Skill {
  name: string;
  match: number;
}

// interface ScrapedData {
//   jobData: JobData;
//   requirements: string[];
//   skills: Skill[];
// }

export function useContentScriptData() {
  const [onJobsPage, setOnJobsPage] = useState<boolean | null>(null);
  const [scrapedData, setScrapedData] = useState<any | null>(null);
  const [dataIsLoaded, setDataIsLoaded] = useState(false);

  useEffect(() => {
    const checkJobsPage = async () => {
      try {
        const tabs = await browser.tabs.query({
          active: true,
          currentWindow: true,
        });
        const url = tabs[0]?.url || "";
        setOnJobsPage(url.includes("linkedin.com/jobs/"));
      } catch (error) {
        console.error("Error querying tabs:", error);
        setOnJobsPage(false);
      }
    };

    checkJobsPage();

    const handleMessage = (message: any) => {
      if (message.type === "RELAYED_SCRAPED_DATA") {
        const temp = message.data;
        setScrapedData(temp);
        setDataIsLoaded(true);
      }
    };

    browser.runtime.onMessage.addListener(handleMessage);

    return () => {
      browser.runtime.onMessage.removeListener(handleMessage);
    };
  }, []);

  return { onJobsPage, scrapedData, dataIsLoaded };
}

export default function JobSummarizer() {
  const { onJobsPage, scrapedData, dataIsLoaded } = useContentScriptData();
  const jobData = {
    title: "Senior Frontend Engineer",
    company: "TechCorp Inc.",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$120k - $160k",
    posted: "2 days ago",
  };

  const requirements = [
    "5+ years React experience",
    "TypeScript proficiency",
    "Next.js framework knowledge",
    "GraphQL and REST APIs",
    "Testing frameworks (Jest, Cypress)",
  ];

  const skills = [
    { name: "React", match: 95 },
    { name: "TypeScript", match: 88 },
    { name: "Next.js", match: 92 },
    { name: "GraphQL", match: 75 },
    { name: "Testing", match: 82 },
  ];

  if (!onJobsPage) {
    return (
      <div className="extension-popup">
        <Card className="w-full max-w-md">
          <CardContent className="p-4">
            <h1 className="text-3xl text-center font-bold p-4">
              Go to Jobs Page to Access Feature
            </h1>
            <Button
              onClick={() =>
                chrome.tabs.create({
                  // Make sure to put in recommended at the end of the url
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
  if (!dataIsLoaded) {
    return <h1>Loading...</h1>;
  }

  return (
    <div className="extension-popup">
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
            <Badge variant="secondary" className="text-xs">
              <CheckCircle className="w-3 h-3 mr-1" />
              Analyzed
            </Badge>
          </div>
        </CardHeader>

        {dataIsLoaded && scrapedData ? (
          <div className="p-2">
            <h2 className="font-bold">Scraped Data</h2>
            <p>Company: {scrapedData.company}</p>
          </div>
        ) : null}

        <CardContent className="space-y-4">
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
                {jobData.salary}
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3" />
                {jobData.posted}
              </div>
            </div>
          </div>

          <Separator />

          {/* Key Requirements */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Key Requirements</h4>
            <div className="space-y-1">
              {requirements.map((req, index) => (
                <div key={index} className="flex items-center gap-2 text-xs">
                  <div className="w-1.5 h-1.5 bg-primary rounded-full" />
                  {req}
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Skill Match */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm">Your Skill Match</h4>
            <div className="space-y-2">
              {skills.map((skill) => (
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

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button size="sm" className="flex-1">
              <Mail className="w-3 h-3 mr-1" />
              Generate Cover Letter
            </Button>
            <Button size="sm" variant="outline">
              <Copy className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-3 h-3" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
