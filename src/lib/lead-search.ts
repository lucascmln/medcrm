/**
 * Shared lead-search logic.
 *
 * Both the Leads page (`/api/leads?search=`) and the Cmd/Ctrl+K command palette
 * hit the same `/api/leads` endpoint, so they share this single definition of
 * "what a search term matches". Keeping the rules here — instead of inline in the
 * route — makes the behaviour testable and guarantees the two surfaces never drift.
 *
 * A term matches a lead when it appears (case-insensitive, partial) in ANY of:
 *   - full name / first name / last name (a single `name` column holds the full
 *     name, so a substring match already covers first name, surname and any slice)
 *   - phone, compared both literally and digits-to-digits (so "980030008" matches
 *     a phone stored as "(11) 98003-0008")
 *   - e-mail
 *   - procedure / interest
 *
 * IMPORTANT: search never filters by channel/origin. Channel filtering is a
 * separate, explicit filter (`trafficSource` / `sourceId`) applied by the caller.
 */

/** Keep only digits — used to compare phone numbers regardless of formatting. */
export function normalizePhone(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

/** Fields a plain text term is matched against. Deliberately excludes channel/origin. */
export const LEAD_SEARCH_TEXT_FIELDS = ["name", "phone", "email", "procedure"] as const;

/**
 * Build the Prisma `OR` array for a search term (text fields only).
 * The phone digit-normalized branch is added by the route via raw SQL, because
 * it needs `regexp_replace` on the stored column — see `phoneDigits()`.
 */
export function buildLeadSearchOr(term: string): Array<Record<string, unknown>> {
  const t = term.trim();
  if (!t) return [];
  return LEAD_SEARCH_TEXT_FIELDS.map((field) => ({
    [field]: { contains: t, mode: "insensitive" },
  }));
}

/**
 * Digits of the term when it's worth doing a phone-normalized lookup.
 * Returns "" (skip) for fewer than 3 digits to avoid matching everything.
 */
export function phoneDigits(term: string): string {
  const digits = normalizePhone(term);
  return digits.length >= 3 ? digits : "";
}

/** Shape needed to evaluate a match in memory / in tests. */
export interface SearchableLead {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  procedure?: string | null;
}

/**
 * Pure, in-memory mirror of the server-side match semantics. This is the
 * canonical definition the API is expected to reproduce; it exists so the rules
 * can be exercised directly in unit tests with concrete lead objects.
 */
export function leadMatchesSearch(lead: SearchableLead, term: string): boolean {
  const t = term.trim().toLowerCase();
  if (!t) return true; // empty search matches everything (no filter)

  for (const field of LEAD_SEARCH_TEXT_FIELDS) {
    const value = (lead as Record<string, unknown>)[field];
    if (typeof value === "string" && value.toLowerCase().includes(t)) return true;
  }

  const digits = phoneDigits(term);
  if (digits) {
    const phoneD = normalizePhone(lead.phone);
    if (phoneD.includes(digits)) return true;
  }

  return false;
}
