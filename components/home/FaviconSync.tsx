"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

let cachedFaviconUrl: string | null = null;

export function FaviconSync() {
  const pathname = usePathname();

  useEffect(() => {
    let active = true;

    const applyFavicon = (href: string) => {
      const iconSelectors = [
        'link[rel="icon"]',
        'link[rel="shortcut icon"]',
        'link[rel="apple-touch-icon"]',
      ];

      iconSelectors.forEach((selector) => {
        let link = document.querySelector<HTMLLinkElement>(selector);

        if (!link) {
          link = document.createElement("link");
          link.rel = selector.includes("apple-touch-icon")
            ? "apple-touch-icon"
            : selector.includes("shortcut")
              ? "shortcut icon"
              : "icon";
          document.head.appendChild(link);
        }

        link.href = href;
      });
    };

    const loadFavicon = async () => {
      if (cachedFaviconUrl) {
        applyFavicon(cachedFaviconUrl);
      }

      try {
        const response = await fetch("/api/media?purpose=site_favicon");

        if (!response.ok) return;

        const result = await response.json();
        const firstFavicon = Array.isArray(result.media)
          ? result.media[0]
          : null;
        const faviconUrl =
          typeof firstFavicon?.image_url === "string"
            ? firstFavicon.image_url
            : "";

        if (active && faviconUrl) {
          cachedFaviconUrl = faviconUrl;
          applyFavicon(faviconUrl);
          return;
        }

        if (active && !cachedFaviconUrl) {
          applyFavicon("/favicon.ico");
        }
      } catch {
        // Ignore and keep existing favicon
      }
    };

    loadFavicon();

    return () => {
      active = false;
    };
  }, [pathname]);

  return null;
}
