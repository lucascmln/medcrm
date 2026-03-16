/**
 * UTM / traffic-source tracking helpers.
 *
 * Usage:
 *   const tracking = extractTracking(body);          // from webhook/form body
 *   const tracking = extractTrackingFromUrl(urlStr); // from raw URL string
 */

export interface TrackingData {
  utmSource:    string | null;
  utmMedium:    string | null;
  utmCampaign:  string | null;
  utmContent:   string | null;
  utmTerm:      string | null;
  landingPage:  string | null;
  referrer:     string | null;
  gclid:        string | null;
  fbclid:       string | null;
  fbc:          string | null;
  fbp:          string | null;
  rawUrlParams: string | null;
  trafficSource: string | null;
}

// ─── Classification ───────────────────────────────────────────────────────────

/**
 * Classifies the traffic source based on UTM params and click IDs.
 *
 * Priority order:
 *  1. Meta Ads   — utm_source=meta | utm_medium=paid_social | fbclid | fbc | fbp
 *  2. Google Ads — gclid | (utm_source=google & utm_medium=cpc)
 *  3. Bio link   — utm_source=linktree | utm_medium=bio | utm_campaign=instagram_bio
 *  4. Google organic — referrer contains google.com (no gclid, not cpc)
 *  5. Direct / unknown
 */
export function classifyTrafficSource(data: Omit<TrackingData, "trafficSource">): string {
  const src      = (data.utmSource   ?? "").toLowerCase();
  const medium   = (data.utmMedium   ?? "").toLowerCase();
  const campaign = (data.utmCampaign ?? "").toLowerCase();
  const ref      = (data.referrer    ?? "").toLowerCase();

  // 1. Meta Ads
  if (
    src === "meta" ||
    src === "facebook" ||
    src === "instagram" ||
    medium === "paid_social" ||
    medium === "cpc" && (src === "meta" || src === "facebook" || src === "instagram") ||
    data.fbclid ||
    data.fbc ||
    data.fbp
  ) {
    return "META_ADS";
  }

  // 2. Google Ads
  if (data.gclid || (src === "google" && medium === "cpc")) {
    return "GOOGLE_ADS";
  }

  // 3. Link na bio / Linktree
  if (
    src === "linktree" ||
    medium === "bio" ||
    campaign === "instagram_bio" ||
    campaign.includes("bio")
  ) {
    return "BIO_LINK";
  }

  // 4. Google orgânico (via referrer)
  if (ref.includes("google.com") || src === "google") {
    return "GOOGLE_ORGANIC";
  }

  // 5. Direto / sem origem
  return "DIRECT";
}

// ─── Extraction helpers ───────────────────────────────────────────────────────

/**
 * Extracts tracking fields from a flat object (webhook body or form payload).
 * Accepts snake_case keys (utm_source) and camelCase (utmSource) interchangeably.
 */
export function extractTracking(body: Record<string, any>): TrackingData {
  const get = (...keys: string[]): string | null => {
    for (const k of keys) {
      const v = body[k];
      if (v && typeof v === "string" && v.trim()) return v.trim();
    }
    return null;
  };

  const partial: Omit<TrackingData, "trafficSource"> = {
    utmSource:    get("utm_source",    "utmSource"),
    utmMedium:    get("utm_medium",    "utmMedium"),
    utmCampaign:  get("utm_campaign",  "utmCampaign"),
    utmContent:   get("utm_content",   "utmContent"),
    utmTerm:      get("utm_term",      "utmTerm"),
    landingPage:  get("landing_page",  "landingPage"),
    referrer:     get("referrer"),
    gclid:        get("gclid"),
    fbclid:       get("fbclid"),
    fbc:          get("fbc"),
    fbp:          get("fbp"),
    rawUrlParams: get("raw_url_params","rawUrlParams"),
  };

  return { ...partial, trafficSource: classifyTrafficSource(partial) };
}

/**
 * Extracts tracking fields from a URL string (landing page URL with query params).
 * Useful when the form posts its own window.location as `landing_page`.
 */
export function extractTrackingFromUrl(urlStr: string, referrer?: string): TrackingData {
  let params: URLSearchParams;
  let rawUrlParams: string | null = null;

  try {
    const url = new URL(urlStr);
    params = url.searchParams;
    rawUrlParams = url.search ? url.search.slice(1) : null; // strip leading "?"
  } catch {
    params = new URLSearchParams();
  }

  const get = (key: string): string | null => {
    const v = params.get(key);
    return v && v.trim() ? v.trim() : null;
  };

  const partial: Omit<TrackingData, "trafficSource"> = {
    utmSource:    get("utm_source"),
    utmMedium:    get("utm_medium"),
    utmCampaign:  get("utm_campaign"),
    utmContent:   get("utm_content"),
    utmTerm:      get("utm_term"),
    landingPage:  urlStr || null,
    referrer:     referrer ?? null,
    gclid:        get("gclid"),
    fbclid:       get("fbclid"),
    fbc:          get("fbc"),
    fbp:          get("fbp"),
    rawUrlParams,
  };

  return { ...partial, trafficSource: classifyTrafficSource(partial) };
}

/**
 * Merges tracking from both the URL and flat body fields.
 * URL params take priority; body fields fill any gaps.
 */
export function mergeTracking(
  urlStr: string | null | undefined,
  body: Record<string, any>,
  referrer?: string
): TrackingData {
  const fromBody = extractTracking(body);
  if (!urlStr) return fromBody;

  const fromUrl = extractTrackingFromUrl(urlStr, referrer ?? fromBody.referrer ?? undefined);

  // URL params win; fall back to body values for gaps
  const merged: Omit<TrackingData, "trafficSource"> = {
    utmSource:    fromUrl.utmSource    ?? fromBody.utmSource,
    utmMedium:    fromUrl.utmMedium    ?? fromBody.utmMedium,
    utmCampaign:  fromUrl.utmCampaign  ?? fromBody.utmCampaign,
    utmContent:   fromUrl.utmContent   ?? fromBody.utmContent,
    utmTerm:      fromUrl.utmTerm      ?? fromBody.utmTerm,
    landingPage:  fromUrl.landingPage  ?? fromBody.landingPage,
    referrer:     fromUrl.referrer     ?? fromBody.referrer,
    gclid:        fromUrl.gclid        ?? fromBody.gclid,
    fbclid:       fromUrl.fbclid       ?? fromBody.fbclid,
    fbc:          fromUrl.fbc          ?? fromBody.fbc,
    fbp:          fromUrl.fbp          ?? fromBody.fbp,
    rawUrlParams: fromUrl.rawUrlParams ?? fromBody.rawUrlParams,
  };

  return { ...merged, trafficSource: classifyTrafficSource(merged) };
}
