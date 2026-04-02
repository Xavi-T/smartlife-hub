"use client";

import { useEffect } from "react";

let cachedFaviconUrl: string | null = null;
let faviconRequestPromise: Promise<string | null> | null = null;

function applyFavicon(href: string) {
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
}

async function fetchFaviconUrl() {
  if (cachedFaviconUrl) {
    return cachedFaviconUrl;
  }

  if (!faviconRequestPromise) {
    faviconRequestPromise = fetch("/api/media?purpose=site_favicon")
      .then(async (response) => {
        if (!response.ok) return null;

        const result = await response.json();
        const firstFavicon = Array.isArray(result.media)
          ? result.media[0]
          : null;
        const faviconUrl =
          typeof firstFavicon?.image_url === "string"
            ? firstFavicon.image_url
            : "";

        if (faviconUrl) {
          cachedFaviconUrl = faviconUrl;
          return faviconUrl;
        }

        return null;
      })
      .catch(() => null)
      .finally(() => {
        faviconRequestPromise = null;
      });
  }

  return faviconRequestPromise;
}

export function FaviconSync() {
  useEffect(() => {
    let active = true;

    const loadFavicon = async () => {
      if (cachedFaviconUrl) {
        applyFavicon(cachedFaviconUrl);
      }

      const faviconUrl = await fetchFaviconUrl();

      if (active && faviconUrl) {
        applyFavicon(faviconUrl);
        return;
      }

      if (active && !cachedFaviconUrl) {
        applyFavicon("/favicon.ico");
      }
    };

    loadFavicon();

    return () => {
      active = false;
    };
  }, []);

  return null;
}
