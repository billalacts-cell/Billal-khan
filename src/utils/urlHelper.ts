/**
 * Utilities to validate and normalize Google Forms URLs
 */

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  errorMessage?: string;
}

export function validateAndNormalizeFormUrl(rawUrl: string): UrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return {
      isValid: false,
      normalizedUrl: '',
      errorMessage: 'Please enter a Google Form URL.'
    };
  }

  // Add protocol if omitted
  let candidate = trimmed;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname;

    // Allowed hosts: forms.gle, docs.google.com, forms.google.com
    const isFormsGle = host === 'forms.gle' || host.endsWith('.forms.gle');
    const isDocsGoogle = host === 'docs.google.com' && pathname.includes('/forms');
    const isGoogleForms = host === 'forms.google.com';

    if (!isFormsGle && !isDocsGoogle && !isGoogleForms) {
      return {
        isValid: false,
        normalizedUrl: candidate,
        errorMessage: 'Must be a valid Google Forms URL (e.g., https://forms.gle/... or https://docs.google.com/forms/d/...)'
      };
    }

    return {
      isValid: true,
      normalizedUrl: parsed.href
    };
  } catch {
    return {
      isValid: false,
      normalizedUrl: rawUrl,
      errorMessage: 'Invalid URL format.'
    };
  }
}

/**
 * Converts a Google Forms URL to an embed-friendly URL with ?embedded=true
 */
export function getEmbeddableFormUrl(rawUrl: string): { 
  embedUrl: string; 
  isConverted: boolean; 
  isShortUrl: boolean;
  originalUrl: string;
} {
  const original = rawUrl.trim();
  if (!original) {
    return { embedUrl: '', isConverted: false, isShortUrl: false, originalUrl: '' };
  }

  let candidate = original;
  if (!/^https?:\/\//i.test(candidate)) {
    candidate = 'https://' + candidate;
  }

  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isShortUrl = host === 'forms.gle' || host.endsWith('.forms.gle');

    if (isShortUrl) {
      // Short URLs (forms.gle) issue HTTP 302 redirects.
      // We pass the short URL directly, while flagging isShortUrl=true
      return {
        embedUrl: parsed.href,
        isConverted: false,
        isShortUrl: true,
        originalUrl: original
      };
    }

    if (host === 'docs.google.com' || host === 'forms.google.com') {
      // If path doesn't end with viewform or formResponse, ensure /viewform is used
      if (!parsed.pathname.endsWith('/viewform') && !parsed.pathname.endsWith('/formResponse')) {
        // e.g. /forms/d/e/.../ -> /forms/d/e/.../viewform
        if (parsed.pathname.endsWith('/')) {
          parsed.pathname += 'viewform';
        } else {
          parsed.pathname += '/viewform';
        }
      }

      parsed.searchParams.set('embedded', 'true');
      return {
        embedUrl: parsed.href,
        isConverted: true,
        isShortUrl: false,
        originalUrl: original
      };
    }

    return {
      embedUrl: parsed.href,
      isConverted: false,
      isShortUrl: false,
      originalUrl: original
    };
  } catch {
    return {
      embedUrl: original,
      isConverted: false,
      isShortUrl: false,
      originalUrl: original
    };
  }
}

/**
 * Format relative time (e.g. "Just now", "5 mins ago", "Yesterday", "Never")
 */
export function formatTimeAgo(timestamp?: number | null): string {
  if (!timestamp) return 'Never opened';

  const now = Date.now();
  const diffMs = now - timestamp;
  if (diffMs < 0) return 'Just now';

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;

  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;

  const diffDays = Math.floor(diffHour / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 30) return `${diffDays}d ago`;

  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}
