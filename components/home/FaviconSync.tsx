"use client";

import { useEffect } from "react";

export function FaviconSync() {
  useEffect(() => {
    let active = true;

    const applyFavicon = (href: string) => {
      let faviconLink =
        document.querySelector<HTMLLinkElement>('link[rel="icon"]');

      if (!faviconLink) {
        faviconLink = document.createElement("link");
        faviconLink.rel = "icon";
        document.head.appendChild(faviconLink);
      }

      faviconLink.href = href;
    };

    const loadFavicon = async () => {
      try {
        const response = await fetch("/api/media?purpose=site_favicon", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = await response.json();
        const firstFavicon = Array.isArray(result.media)
          ? result.media[0]
          : null;

        if (active && firstFavicon?.image_url) {
          applyFavicon(firstFavicon.image_url);
        }
      } catch {
        // Ignore and keep existing favicon
      }
    };

    loadFavicon();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
