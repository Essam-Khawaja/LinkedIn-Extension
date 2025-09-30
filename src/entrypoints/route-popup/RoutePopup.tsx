import { Button } from "@/components/ui/button";
import React from "react";

function RoutePopup() {
  return (
    <div className="extension-popup flex p-4 gap-5 flex-col">
      <h1 className="text-2xl text-center">
        Please open LinkedIn to use Job Hunt Copilot.
      </h1>
      <Button
        variant={"default"}
        onClick={() => chrome.tabs.create({ url: "https://www.linkedin.com" })}
        className="cursor-p"
      >
        Go to LinkedIn
      </Button>
    </div>
  );
}

export default RoutePopup;
