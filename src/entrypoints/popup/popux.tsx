import { useEffect, useState } from "react";
import MainPopup from "../main-popup/MainPopup";
import RoutePopup from "../route-popup/RoutePopup";
import checkPage from "@/lib/checkPage";
import { ExtensionPopup } from "../main-popup/NewPopup";

function PopupApp() {
  const [onLinkedIn, setOnLinkedIn] = useState<boolean | null>(null);

  useEffect(() => {
    // chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    //   const url = tabs[0]?.url || "";
    //   setOnLinkedIn(url.includes("linkedin.com"));
    // });

    async function check() {
      const isPresentOnPage = await checkPage("linkedin.com/");
      setOnLinkedIn(isPresentOnPage);
    }
    check();
  }, []);

  if (onLinkedIn === null) return <div>Loading...</div>;

  // if (!onLinkedIn) {
  //   return <RoutePopup />;
  // }

  return (
    <div>
      <ExtensionPopup />
    </div>
  );
}

export default PopupApp;
