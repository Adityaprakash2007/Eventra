import { useEffect } from "react";

/** Sets the document title for a page: "Page · Eventra" */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · Eventra` : "Eventra — Event Registration & Ticketing";
  }, [title]);
}
