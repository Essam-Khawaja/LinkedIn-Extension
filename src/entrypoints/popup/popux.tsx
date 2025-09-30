import { useEffect, useState } from "react";
import { MainPopup } from "../main-popup/MainPopup";
import RoutePopup from "../route-popup/RoutePopup";

function PopupApp() {
  const [onLinkedIn, setOnLinkedIn] = useState<boolean | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || "";
      setOnLinkedIn(url.includes("linkedin.com"));
    });
  }, []);

  if (onLinkedIn === null) return <div>Loading...</div>;

  if (!onLinkedIn) {
    return <RoutePopup />;
  }

  return <MainPopup />;
}

export default PopupApp;
