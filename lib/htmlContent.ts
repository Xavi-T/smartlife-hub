const HTML_TAG_PATTERN = /<\/?[a-z][\s\S]*?>/i;
const ESCAPED_HTML_TAG_PATTERN = /&lt;\/?[a-z][\s\S]*?&gt;/i;

export function looksLikeHtmlContent(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}

export function looksLikeEscapedHtmlContent(value: string): boolean {
  return ESCAPED_HTML_TAG_PATTERN.test(value);
}

export function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

export function normalizeHtmlContent(value?: string | null): string {
  const content = value || "";
  if (!content) return "";

  if (looksLikeEscapedHtmlContent(content)) {
    return decodeBasicHtmlEntities(content);
  }

  const decodedOnce = content.replace(
    /&amp;(lt|gt|quot|#39|#x27|apos|nbsp|amp);/gi,
    "&$1;",
  );

  if (decodedOnce !== content && looksLikeEscapedHtmlContent(decodedOnce)) {
    return decodeBasicHtmlEntities(decodedOnce);
  }

  return content;
}
