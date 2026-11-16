// Sync Jesolo tourism data. Idempotent via upsert. Two ways in:
//
// 1. Pull (pg_cron every 3 days, or a manual POST without a sync key):
//    Deskline events + natale.jesolo.it and lightson.jesolo.it pages and
//    events. Reading jesolo.it
//    (WordPress on SiteGround) from here is blocked by the host's anti-bot
//    CAPTCHA, so that pull only runs when explicitly requested with
//    {"include_wordpress": true}.
// 2. Push (POST with header x-wizard-sync-key): the WordPress plugin
//    "Jesolo Wizard Sync" installed on jesolo.it sends its own data
//    (events, categories, facilities, activities, bike pages, beaches, pages).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-wizard-sync-key",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
// Shared secret with the WordPress plugin (Edge Functions → Secrets).
const WP_SYNC_KEY = Deno.env.get("WP_SYNC_KEY")?.trim() || null;

const WORDPRESS_SITE = "jesolo.it";
const NATALE_SITE = "natale.jesolo.it";
const NATALE_BASE = "https://natale.jesolo.it";
const NATALE_MAX_PAGES = 80;
const LIGHTSON_SITE = "lightson.jesolo.it";
const LIGHTSON_BASE = "https://lightson.jesolo.it";
// Legal pages of the content sites carry no tourist information.
const EXCLUDED_PATHS = /(^|\/)(privacy|cookie)[^/]*$/i;
// Pages shorter than this (after HTML stripping) carry no useful content.
const MIN_PAGE_TEXT_LENGTH = 150;

const TRIBE_EVENTS_URL = "https://www.jesolo.it/wp-json/tribe/events/v1/events";
const TRIBE_CATEGORIES_URL =
  "https://www.jesolo.it/wp-json/tribe/events/v1/categories";
const SPORTS_FACILITIES_URL =
  "https://www.jesolo.it/wp-json/wp/v2/strutture_sportive";
const SPORTS_CATEGORIES_URL =
  "https://www.jesolo.it/wp-json/wp/v2/categoria_strutture_sportive";
const ACTIVITIES_URL = "https://www.jesolo.it/wp-json/wp/v2/attivita-jesolo";
const ACTIVITY_CATEGORIES_URL =
  "https://www.jesolo.it/wp-json/wp/v2/attivita-jesolo-category";
// Bike trip articles live as child WP pages under /cicloturismo/ (parent id 1963),
// not under the (empty) percorsi_ciclistici custom post type.
const BIKE_ROUTES_URL = "https://jesolo.it/wp-json/wp/v2/pages?parent=1963";
const BEACH_ESTABLISHMENTS_URL = "https://jesolo.it/wp-json/wp/v2/stabilimenti";

// Plain product token, as tested with SiteGround support (Nov 2026): the
// "Mozilla/5.0 (compatible; ...)" form is dropped before reaching the site
// (connection reset, nothing in the server logs), the plain form gets 200.
const WORDPRESS_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "user-agent": "JesoloWizardSync/1.0",
};

const DESKLINE_BASE_ROOT = "https://webapi.deskline.net/jesolo";
const DESKLINE_LANGS = ["it", "en", "de"] as const;
type DesklineLang = typeof DESKLINE_LANGS[number];
const DESKLINE_FIELDS =
  "id,name,dbCode,owner,isTopEvent,visibilityLevel,date,hasMoreDates,onlineBookable," +
  "location{place,town,regions,country,coordinate{name,long,lat}}," +
  "plainDescriptions(len:50){description,type},descriptions(types:[32,33]){description,type}," +
  "dateStartTimes,mainCriteria{id,name,value},criteria{groupId,groupName,items{id,name,value}}," +
  "eventGroups{id,name},holidayThemes{id,name,order}," +
  "images(count:1,sizes:[54]){id,name,extension,copyright,author,license,urls,resolutionX,resolutionY,description}," +
  "urlFriendlyName,startTimeDurations{time,weekDays,duration}," +
  "guestCards{id,name,type,hasIcon,iconUrl,webLink}";
const DESKLINE_SORTING = "date,-topEvent,time";
const DESKLINE_PAGE_SIZE = 500;
const DESKLINE_MAX_PAGES = 20;
const DESKLINE_FILTER_ID = Deno.env.get("DESKLINE_FILTER_ID")?.trim() || null;

function stripHtml(s?: string): string | null {
  if (!s) return null;
  return s.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function pickImage(obj: any): string | null {
  if (!obj) return null;
  if (obj.image?.url) return obj.image.url;
  if (Array.isArray(obj.images) && obj.images[0]) {
    const im = obj.images[0];
    if (im.url) return im.url;
    if (im.urls && Array.isArray(im.urls) && im.urls[0]) {
      return im.urls[0].url ?? im.urls[0];
    }
  }
  return null;
}

// ---------- Bike tours extractor ----------
// Each WP page under /cicloturismo/ contains multiple komoot tour embeds.
// We parse the page HTML to extract each tour as an independent record.

function categoryFromSlug(slug?: string | null): string {
  const s = (slug ?? "").toLowerCase();
  if (s.includes("gravel")) return "gravel";
  if (s.includes("giri-in-bici") || s.includes("loop") || s.includes("anello")) return "loop";
  return "easy-family";
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8211;/g, "–")
    .replace(/&#8230;/g, "…")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

function extractBikeTours(
  parentId: number,
  parentSlug: string,
  html: string,
): any[] {
  const category = categoryFromSlug(parentSlug);
  const tours: any[] = [];
  const seen = new Set<string>();

  // Find every komoot tour id reference, in order of appearance
  const tourRegex = /komoot\.com\/it-it\/tour\/(\d+)/g;
  const matches: { id: string; index: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = tourRegex.exec(html)) !== null) {
    matches.push({ id: m[1], index: m.index });
  }
  if (!matches.length) return tours;

  // Group consecutive matches that share the same tour id together.
  // For each unique id, use the earliest occurrence to find the preceding heading
  // and the latest occurrence to delimit the stats block.
  const byId = new Map<string, { first: number; last: number }>();
  for (const { id, index } of matches) {
    const cur = byId.get(id);
    if (!cur) byId.set(id, { first: index, last: index });
    else cur.last = index;
  }

  // Sort by first occurrence to preserve page order
  const orderedIds = Array.from(byId.entries()).sort(
    (a, b) => a[1].first - b[1].first,
  );

  for (let i = 0; i < orderedIds.length; i++) {
    const [tourId, { first, last }] = orderedIds[i];
    const nextStart = i + 1 < orderedIds.length ? orderedIds[i + 1][1].first : html.length;

    // Title: nearest preceding Elementor heading widget (page sections use these,
    // not real <h2>/<h3>). Fall back to <h2>/<h3>.
    const before = html.slice(0, first);
    const widgetMatches = [
      ...before.matchAll(
        /<(h\d|span|div)[^>]*class="[^"]*elementor-heading-title[^"]*"[^>]*>([\s\S]*?)<\/\1>/gi,
      ),
    ];
    const headingMatches = [...before.matchAll(/<(h2|h3)[^>]*>([\s\S]*?)<\/\1>/gi)];
    const candidate = widgetMatches.pop() ?? headingMatches.pop();
    let title = candidate
      ? decodeHtmlEntities(stripHtml(candidate[2]) ?? "").trim()
      : `Tour ${tourId}`;
    // Skip the page-level title that repeats on every section
    if (/^I percorsi cicloturistici/i.test(title)) {
      const prev = widgetMatches[widgetMatches.length - 1];
      if (prev) title = decodeHtmlEntities(stripHtml(prev[2]) ?? "").trim() || title;
    }
    const headingMatch = candidate;

    // Description: text content between that heading and the first komoot link
    let description: string | null = null;
    if (headingMatch) {
      const headEnd = (headingMatch.index ?? 0) + headingMatch[0].length;
      const between = html.slice(headEnd, first);
      const paragraphs = [...between.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
        .map((p) => decodeHtmlEntities(stripHtml(p[1]) ?? "").trim())
        .filter((t) => t && !/^scopri di pi(ù|u)/i.test(t));
      if (paragraphs.length) description = paragraphs.join("\n\n");
    }

    // Stats block: look in a window from first occurrence up to next tour (or +4kb)
    const statsWindow = html.slice(first, Math.min(nextStart, last + 4000));
    const plain = decodeHtmlEntities(stripHtml(statsWindow) ?? "");

    // Duration HH:MM
    let durationMin: number | null = null;
    const durMatch = plain.match(/\b(\d{1,2}):(\d{2})\b/);
    if (durMatch) {
      durationMin = parseInt(durMatch[1], 10) * 60 + parseInt(durMatch[2], 10);
    }

    // Distance like "4,54km" or "10.9 km"
    let distanceKm: number | null = null;
    const distMatch = plain.match(/([\d]+[.,]?\d*)\s*km\b/i);
    if (distMatch) {
      distanceKm = parseFloat(distMatch[1].replace(",", "."));
    }

    // Elevation: first standalone "Nm" after distance (usually the smaller of two)
    let elevationM: number | null = null;
    const elevMatch = plain.match(/\bkm\b[\s\S]{0,200}?(\d+)\s*m\b/i);
    if (elevMatch) elevationM = parseInt(elevMatch[1], 10);

    // Image: first cloudfront komoot image url within the window
    let imageUrl: string | null = null;
    const imgMatch = statsWindow.match(
      /https:\/\/d2exd72xrrp1s7\.cloudfront\.net\/[^\s"')<>]+/,
    );
    if (imgMatch) imageUrl = imgMatch[0];

    const komootUrl = `https://www.komoot.com/it-it/tour/${tourId}`;

    if (seen.has(tourId)) continue;
    seen.add(tourId);

    tours.push({
      id: tourId,
      parent_page_id: parentId,
      title,
      description,
      komoot_url: komootUrl,
      distance_km: distanceKm,
      duration_min: durationMin,
      elevation_m: elevationM,
      image_url: imageUrl,
      category,
    });
  }

  return tours;
}

async function syncBikeTours(supabase: any): Promise<number> {
  // Fetch the 3 parent pages with full content (no _embed needed)
  const pages = await fetchJson(`${BIKE_ROUTES_URL}&per_page=50&page=1`);
  return processBikeTours(supabase, pages);
}

// `pages`: WP REST page objects (content.rendered, slug, id) under /cicloturismo/.
async function processBikeTours(supabase: any, pages: any): Promise<number> {
  if (!Array.isArray(pages) || !pages.length) return 0;

  const allTours: any[] = [];
  for (const page of pages) {
    const html: string = page.content?.rendered ?? "";
    const slug: string = page.slug ?? "";
    if (!html) continue;
    const tours = extractBikeTours(page.id, slug, html);
    console.log(`bike_tours: page "${slug}" → ${tours.length} tours`);
    allTours.push(...tours);
  }

  if (!allTours.length) return 0;

  // A komoot tour may appear on multiple parent pages — dedupe by id (first wins).
  const seen = new Set<string>();
  const deduped = allTours.filter((t) => {
    if (seen.has(t.id)) return false;
    seen.add(t.id);
    return true;
  });

  await mergeUpsert(supabase, "bike_tours", deduped, "id");
  return deduped.length;
}

// Supabase/PostgREST errors are plain objects, not Error instances:
// String(e) would log "[object Object]" and hide the real cause.
function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (e && typeof e === "object") {
    const o = e as Record<string, unknown>;
    const parts = [o.message, o.details, o.hint, o.code ? `code ${o.code}` : null]
      .filter((p) => typeof p === "string" && p.trim() !== "");
    if (parts.length) return parts.join(" | ");
    try {
      return JSON.stringify(e);
    } catch {
      // fall through
    }
  }
  return String(e);
}

async function logSync(
  supabase: any,
  source: string,
  status: string,
  count: number,
  error: string | null,
  started: string,
) {
  await supabase.from("sync_log").insert({
    source,
    status,
    records_synced: count,
    error,
    started_at: started,
    finished_at: new Date().toISOString(),
  });
}

async function fetchJson(url: string) {
  const response = await fetch(url, { headers: WORDPRESS_HEADERS });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${text.slice(0, 500)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON response: ${text.slice(0, 200)}`);
  }
}

// ---------- Non-destructive upsert ----------
// Sync sources occasionally return null / empty strings for fields that we
// already have populated (upstream glitches, removed translations, etc.).
// A plain upsert would overwrite those columns with the empty value and
// silently delete real data. mergeUpsert preserves the existing DB value
// whenever the incoming value is "empty", and otherwise applies the update.
//
// JSONB i18n columns are merged per language key so a missing translation
// for one language never wipes the others we previously stored.

// Columns to merge per-language instead of overwriting wholesale.
const I18N_COLUMNS: Record<string, string[]> = {
  deskline_events: [
    "name_i18n",
    "description_full_i18n",
    "description_short_i18n",
    "url_friendly_name_i18n",
    "place_i18n",
    "town_i18n",
  ],
  deskline_themes: ["name_i18n"],
};

function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === "string") return v.trim() === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (!keys.length) return true;
    return keys.every((k) => isEmptyValue(obj[k]));
  }
  // numbers (incl. 0) and booleans (incl. false) are real values
  return false;
}

function mergeI18nValue(existing: unknown, incoming: unknown): Record<string, unknown> {
  const out: Record<string, unknown> =
    existing && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {};
  if (incoming && typeof incoming === "object" && !Array.isArray(incoming)) {
    for (const [k, v] of Object.entries(incoming as Record<string, unknown>)) {
      if (!isEmptyValue(v)) out[k] = v;
    }
  }
  return out;
}

async function mergeUpsert(
  supabase: any,
  table: string,
  rows: Record<string, any>[],
  pk: string = "id",
): Promise<number> {
  if (!rows.length) return 0;

  const ids = rows.map((r) => r[pk]).filter((v) => v !== null && v !== undefined);
  const { data: existingRows, error: selErr } = await supabase
    .from(table)
    .select("*")
    .in(pk, ids);
  if (selErr) throw selErr;

  const existingMap = new Map<any, any>();
  for (const r of existingRows ?? []) existingMap.set(r[pk], r);

  const i18nCols = I18N_COLUMNS[table] ?? [];
  let newCount = 0;
  let updatedCount = 0;
  let preservedFieldCount = 0;

  const merged = rows.map((row) => {
    const existing = existingMap.get(row[pk]);
    if (!existing) {
      newCount++;
      return row;
    }
    updatedCount++;
    const out: Record<string, any> = { ...existing };
    for (const [col, newVal] of Object.entries(row)) {
      if (i18nCols.includes(col)) {
        out[col] = mergeI18nValue(existing[col], newVal);
        continue;
      }
      if (isEmptyValue(newVal)) {
        if (!isEmptyValue(existing[col])) preservedFieldCount++;
        // keep existing value
      } else {
        out[col] = newVal;
      }
    }
    return out;
  });

  // Batches mix brand-new rows (no created_at/updated_at) with merged
  // existing rows (all columns). PostgREST builds the column list from the
  // union of keys and, by default, writes NULL for keys a row lacks — which
  // breaks NOT NULL columns like created_at. defaultToNull: false makes it
  // use the column DEFAULT instead.
  const { error } = await supabase
    .from(table)
    .upsert(merged, { onConflict: pk, defaultToNull: false });
  if (error) throw error;

  console.log(
    `[merge] ${table}: ${rows.length} rows (${newCount} new, ${updatedCount} updated, ${preservedFieldCount} fields preserved)`,
  );
  return rows.length;
}

// ---------- TRIBE ----------
async function syncTribeCategories(supabase: any) {
  const all: any[] = [];
  let page = 1;
  while (page < 20) {
    const d = await fetchJson(`${TRIBE_CATEGORIES_URL}?per_page=100&page=${page}`);
    const cats = d.categories ?? [];
    if (!cats.length) break;
    all.push(...cats);
    if (cats.length < 100) break;
    page++;
  }
  return processTribeCategories(supabase, all);
}

async function processTribeCategories(supabase: any, all: any[]) {
  if (!Array.isArray(all) || !all.length) return 0;
  const rows = all.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    count: c.count ?? 0,
  }));
  await mergeUpsert(supabase, "categories", rows, "id");
  return rows.length;
}

async function syncTribeEvents(supabase: any) {
  const allEvents: any[] = [];
  let page = 1;
  while (page < 50) {
    const d = await fetchJson(
      `${TRIBE_EVENTS_URL}?per_page=50&page=${page}&start_date=${
        new Date().toISOString().slice(0, 10)
      }`,
    );
    const evs = d.events ?? [];
    if (!evs.length) break;
    allEvents.push(...evs);
    if (evs.length < 50) break;
    page++;
  }
  return processTribeEvents(supabase, allEvents);
}

// `allEvents`: Tribe REST event objects (tribe/events/v1/events → events[]).
async function processTribeEvents(supabase: any, allEvents: any[]) {
  if (!Array.isArray(allEvents)) return 0;
  const venuesMap = new Map<number, any>();
  const eventCats: { event_id: number; category_id: number }[] = [];

  for (const e of allEvents) {
    if (e.venue && e.venue.id) {
      venuesMap.set(e.venue.id, {
        id: e.venue.id,
        name: e.venue.venue ?? e.venue.name ?? "",
        slug: e.venue.slug,
        address: e.venue.address,
        city: e.venue.city,
        province: e.venue.province,
        country: e.venue.country,
        zip: e.venue.zip,
        phone: e.venue.phone,
        website: e.venue.website,
        url: e.venue.url,
      });
    }
    if (Array.isArray(e.categories)) {
      for (const c of e.categories) {
        eventCats.push({ event_id: e.id, category_id: c.id });
      }
    }
  }

  if (venuesMap.size) {
    await mergeUpsert(supabase, "venues", Array.from(venuesMap.values()), "id");
  }

  const eventRows = allEvents.map((e) => ({
    id: e.id,
    title: stripHtml(e.title) ?? "",
    description: stripHtml(e.description),
    excerpt: stripHtml(e.excerpt),
    slug: e.slug,
    url: e.url,
    start_date: e.start_date ? new Date(e.start_date).toISOString() : null,
    end_date: e.end_date ? new Date(e.end_date).toISOString() : null,
    all_day: !!e.all_day,
    cost: e.cost ?? null,
    featured: !!e.featured,
    venue_id: e.venue?.id ?? null,
    kid_friendly: false,
    image_url: pickImage(e),
  }));

  if (eventRows.length) {
    await mergeUpsert(supabase, "events", eventRows, "id");
  }

  if (eventCats.length) {
    // Make unique
    const seen = new Set<string>();
    const uniq = eventCats.filter((r) => {
      const k = `${r.event_id}-${r.category_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const { error } = await supabase.from("event_categories").upsert(uniq, {
      onConflict: "event_id,category_id",
    });
    if (error) console.error("event_categories upsert:", error);
  }

  return eventRows.length;
}

// ---------- WP v2 generic ----------
async function syncWpCategories(supabase: any, url: string, table: string) {
  const all: any[] = [];
  let page = 1;
  while (page < 20) {
    const d = await fetchJson(`${url}?per_page=100&page=${page}`);
    if (!Array.isArray(d) || !d.length) break;
    all.push(...d);
    if (d.length < 100) break;
    page++;
  }
  return processWpCategories(supabase, all, table);
}

// `all`: taxonomy terms ({ id, name, slug }).
async function processWpCategories(supabase: any, all: any[], table: string) {
  if (!Array.isArray(all) || !all.length) return 0;
  const rows = all.map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
  await mergeUpsert(supabase, table, rows, "id");
  return rows.length;
}

type WpSyncOptions = {
  joinTable?: string;
  fkCol?: string;
  taxKey?: string;
};

async function syncWpItems(
  supabase: any,
  url: string,
  table: string,
  options: WpSyncOptions = {},
) {
  const all: any[] = [];
  let page = 1;
  const sep = url.includes("?") ? "&" : "?";
  while (page < 50) {
    const d = await fetchJson(`${url}${sep}per_page=50&page=${page}&_embed=1`);
    if (!Array.isArray(d) || !d.length) break;
    all.push(...d);
    if (d.length < 50) break;
    page++;
  }
  return processWpItems(supabase, all, table, options);
}

// `all`: WP REST post objects, embedded (_embed) for the featured image.
async function processWpItems(
  supabase: any,
  all: any[],
  table: string,
  options: WpSyncOptions = {},
) {
  const { joinTable, fkCol, taxKey } = options;
  if (!Array.isArray(all) || !all.length) return 0;

  const rows = all.map((it) => ({
    id: it.id,
    title: stripHtml(it.title?.rendered) ?? "",
    description: stripHtml(it.content?.rendered),
    excerpt: stripHtml(it.excerpt?.rendered),
    slug: it.slug,
    link: it.link,
    image_url: it._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? null,
  }));

  await mergeUpsert(supabase, table, rows, "id");

  if (!joinTable || !fkCol || !taxKey) {
    return rows.length;
  }

  const joins: any[] = [];
  for (const it of all) {
    const cats = it[taxKey];
    if (Array.isArray(cats)) {
      for (const cid of cats) joins.push({ [fkCol]: it.id, category_id: cid });
    }
  }
  if (joins.length) {
    const seen = new Set<string>();
    const uniq = joins.filter((r) => {
      const k = `${r[fkCol]}-${r.category_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const { error: je } = await supabase.from(joinTable).upsert(uniq, {
      onConflict: `${fkCol},category_id`,
    });
    if (je) console.error(`${joinTable} upsert:`, je);
  }
  return rows.length;
}

const DESKLINE_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "accept-language": "it-IT,it;q=0.9,en;q=0.8",
  "dw-source": "desklineweb",
  "origin": "https://jesolo.it",
  "referer": "https://jesolo.it/",
  "user-agent": "Mozilla/5.0 (compatible; JesoloWizardSync/1.0)",
};

function buildDesklineEventsUrl(
  pageNo: number,
  pageSize: number,
  filterId?: string | null,
  lang: DesklineLang = "it",
): string {
  const url = new URL(`${DESKLINE_BASE_ROOT}/${lang}/events`);
  url.searchParams.set("fields", DESKLINE_FIELDS);
  url.searchParams.set("sortingFields", DESKLINE_SORTING);
  url.searchParams.set("pageNo", String(pageNo));
  url.searchParams.set("pageSize", String(pageSize));
  if (filterId) {
    url.searchParams.set("filterId", filterId);
  }
  return url.toString();
}

function extractDesklineItems(payload: any): any[] {
  const items = payload?.items ?? payload?.data?.items ?? payload?.data ?? payload?.events ?? [];
  return Array.isArray(items) ? items : [];
}

function isMissingDesklineFilterError(message: string): boolean {
  return message.includes("filter object") && message.includes("does not exist");
}

async function fetchDesklineEventsPage(
  sessionId: string,
  pageNo: number,
  filterId?: string | null,
  lang: DesklineLang = "it",
) {
  const url = buildDesklineEventsUrl(pageNo, DESKLINE_PAGE_SIZE, filterId, lang);
  const response = await fetch(url, {
    headers: {
      ...DESKLINE_HEADERS,
      "dw-sessionid": sessionId,
      "accept-language": `${lang}-${lang.toUpperCase()},${lang};q=0.9`,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Deskline API ${response.status}: ${text.slice(0, 500)}`);
  }

  return response.json();
}

async function fetchAllDesklineEvents(sessionId: string, lang: DesklineLang = "it") {
  const allItems: any[] = [];
  let pagesFetched = 0;
  let usedFilter = Boolean(DESKLINE_FILTER_ID);
  let fallbackToUnfiltered = false;

  const runPagedFetch = async (filterId?: string | null) => {
    const pagedItems: any[] = [];
    let pageCount = 0;

    for (let pageNo = 1; pageNo <= DESKLINE_MAX_PAGES; pageNo++) {
      const payload = await fetchDesklineEventsPage(sessionId, pageNo, filterId, lang);
      const items = extractDesklineItems(payload);
      pageCount++;

      console.log(
        `Deskline[${lang}] page ${pageNo}: ${items.length} events${filterId ? " (filtered)" : " (unfiltered)"}`,
      );

      if (!items.length) break;
      pagedItems.push(...items);
      if (items.length < DESKLINE_PAGE_SIZE) break;
    }

    return { items: pagedItems, pageCount };
  };

  try {
    const result = await runPagedFetch(DESKLINE_FILTER_ID);
    allItems.push(...result.items);
    pagesFetched = result.pageCount;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!DESKLINE_FILTER_ID || !isMissingDesklineFilterError(message)) {
      throw error;
    }

    console.warn("Deskline filter missing, retrying without filter");
    fallbackToUnfiltered = true;
    usedFilter = false;

    const result = await runPagedFetch(null);
    allItems.push(...result.items);
    pagesFetched = result.pageCount;
  }

  console.log(
    `Deskline fetch complete: ${allItems.length} events across ${pagesFetched} pages; mode=${fallbackToUnfiltered ? "fallback-unfiltered" : usedFilter ? "filtered" : "unfiltered"}`,
  );

  return { items: allItems, pagesFetched, usedFilter, fallbackToUnfiltered };
}

function fmtDate(d: Date): string {
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
}

async function fetchOccurrences(
  eventId: string,
  dbCode: string,
  sessionId: string,
): Promise<any[]> {
  const occurrences: any[] = [];
  let fromDate = fmtDate(new Date());
  const MAX_PAGES = 10;

  for (let i = 0; i < MAX_PAGES; i++) {
    const url = `${DESKLINE_BASE_ROOT}/it/events/${dbCode}/${eventId}` +
      `?fields=nextOccurrences(fromDate:%22${fromDate}%22,count:12)` +
      `{items{date,dayOfWeek,startTime,duration},hasMoreItems}`;

    const r = await fetch(url, {
      headers: { ...DESKLINE_HEADERS, "dw-sessionid": sessionId },
    });
    if (!r.ok) {
      console.warn(`Occurrences fetch failed for ${eventId} (${r.status})`);
      break;
    }
    const data = await r.json();
    const block = data?.nextOccurrences ?? data?.data?.nextOccurrences;
    const items = block?.items ?? [];
    if (!items.length) break;
    occurrences.push(...items);
    if (!block?.hasMoreItems) break;

    const last = items[items.length - 1]?.date;
    if (!last) break;
    const nextDay = new Date(last);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    fromDate = fmtDate(nextDay);
  }

  return occurrences;
}

async function processInChunks<T>(
  items: T[],
  size: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    const chunk = items.slice(i, i + size);
    await Promise.all(chunk.map(fn));
  }
}

// ---------- DESKLINE ----------
async function syncDeskline(supabase: any) {
  const sessionId = `W${Date.now()}`;

  // Fetch all 3 languages in parallel
  const perLang = await Promise.all(
    DESKLINE_LANGS.map(async (lang) => {
      try {
        const res = await fetchAllDesklineEvents(sessionId, lang);
        return { lang, items: res.items };
      } catch (err) {
        console.error(`Deskline[${lang}] fetch failed:`, err instanceof Error ? err.message : err);
        return { lang, items: [] as any[] };
      }
    }),
  );

  const itItems = perLang.find((p) => p.lang === "it")?.items ?? [];
  if (!itItems.length) return 0;

  // Build per-language lookup by event id for merging localized fields
  const byLang: Record<DesklineLang, Map<string, any>> = {
    it: new Map(),
    en: new Map(),
    de: new Map(),
  };
  for (const { lang, items } of perLang) {
    for (const e of items) byLang[lang].set(String(e.id), e);
  }

  const items = itItems;

  console.log(
    `Deskline sync: it=${byLang.it.size} en=${byLang.en.size} de=${byLang.de.size}`,
  );

  const pickDesc = (e: any, type: number) =>
    e?.descriptions?.find((d: any) => d.type === type)?.description ??
      e?.plainDescriptions?.[0]?.description ?? null;

  const eventRows: any[] = [];
  const themesMap = new Map<
    string,
    { id: string; name: string; name_i18n: Record<string, string>; order: number | null }
  >();
  const eventThemeRows: { event_id: string; theme_id: string }[] = [];
  const recurringRefs: { id: string; dbCode: string }[] = [];

  for (const e of items) {
    const id = String(e.id);
    const eIt = e;
    const eEn = byLang.en.get(id);
    const eDe = byLang.de.get(id);

    const fullDesc = pickDesc(eIt, 32);
    const shortDesc = pickDesc(eIt, 33);

    const name_i18n: Record<string, string> = {};
    const description_full_i18n: Record<string, string | null> = {};
    const description_short_i18n: Record<string, string | null> = {};
    const url_friendly_name_i18n: Record<string, string | null> = {};
    const place_i18n: Record<string, string | null> = {};
    const town_i18n: Record<string, string | null> = {};

    for (const [lang, src] of [["it", eIt], ["en", eEn], ["de", eDe]] as const) {
      if (!src) continue;
      if (src.name) name_i18n[lang] = src.name;
      description_full_i18n[lang] = stripHtml(pickDesc(src, 32));
      description_short_i18n[lang] = stripHtml(pickDesc(src, 33));
      url_friendly_name_i18n[lang] = src.urlFriendlyName ?? null;
      place_i18n[lang] = src.location?.place ?? null;
      town_i18n[lang] = src.location?.town ?? null;
    }

    const img = e.images?.[0];
    const imgUrl = img?.urls?.[0]?.url ?? img?.urls?.[0] ?? null;

    eventRows.push({
      id,
      name: e.name ?? "",
      name_i18n,
      date: e.date ? new Date(e.date).toISOString() : null,
      has_more_dates: !!e.hasMoreDates,
      place: e.location?.place ?? null,
      place_i18n,
      town: e.location?.town ?? null,
      town_i18n,
      lat: e.location?.coordinate?.lat ?? null,
      lon: e.location?.coordinate?.long ?? null,
      description_full: stripHtml(fullDesc),
      description_full_i18n,
      description_short: stripHtml(shortDesc),
      description_short_i18n,
      url_friendly_name: e.urlFriendlyName ?? null,
      url_friendly_name_i18n,
      web_url: e.urlFriendlyName
        ? `https://jesolo.it/eventi/tutti-gli-eventi/#/eventi/TRN/${id}/${e.urlFriendlyName}`
        : null,
      image_url: imgUrl,
    });

    // Themes: collect i18n names across languages
    for (const [lang, src] of [["it", eIt], ["en", eEn], ["de", eDe]] as const) {
      if (!src?.holidayThemes) continue;
      for (const t of src.holidayThemes) {
        if (!t?.id) continue;
        const themeId = String(t.id);
        let row = themesMap.get(themeId);
        if (!row) {
          row = { id: themeId, name: t.name ?? themeId, name_i18n: {}, order: typeof t.order === "number" ? t.order : null };
          themesMap.set(themeId, row);
        }
        if (t.name) row.name_i18n[lang] = t.name;
        if (lang === "it" && t.name) row.name = t.name;
        if (lang === "it") eventThemeRows.push({ event_id: id, theme_id: themeId });
      }
    }

    const isRecurring = !!e.hasMoreDates ||
      (Array.isArray(e.startTimeDurations) && e.startTimeDurations.length > 0);
    if (isRecurring && e.dbCode) {
      recurringRefs.push({ id, dbCode: e.dbCode });
    }
  }

  await mergeUpsert(supabase, "deskline_events", eventRows, "id");

  if (themesMap.size) {
    try {
      await mergeUpsert(supabase, "deskline_themes", Array.from(themesMap.values()), "id");
    } catch (tde) {
      console.error("deskline_themes:", tde);
    }
  }

  if (eventThemeRows.length) {
    const seen = new Set<string>();
    const uniq = eventThemeRows.filter((r) => {
      const k = `${r.event_id}-${r.theme_id}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    const { error: te } = await supabase
      .from("deskline_event_themes")
      .upsert(uniq, { onConflict: "event_id,theme_id" });
    if (te) console.error("deskline_event_themes:", te);
  }

  console.log(
    `Deskline: expanding ${recurringRefs.length} recurring events...`,
  );
  let occurrenceCount = 0;

  await processInChunks(recurringRefs, 4, async ({ id, dbCode }) => {
    try {
      const occs = await fetchOccurrences(id, dbCode, sessionId);
      if (!occs.length) return;

      await supabase.from("deskline_event_occurrences").delete().eq(
        "event_id",
        id,
      );

      const rows = occs.map((o: any) => ({
        event_id: id,
        occurrence_date: o.date
          ? new Date(o.date).toISOString().slice(0, 10)
          : null,
        start_time: o.startTime ?? null,
        duration: typeof o.duration === "number" ? o.duration : null,
        day_of_week: typeof o.dayOfWeek === "number" ? o.dayOfWeek : null,
      })).filter((r: any) => r.occurrence_date);

      const seen = new Set<string>();
      const uniq = rows.filter((r: any) => {
        const k = `${r.occurrence_date}-${r.start_time ?? ""}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      if (uniq.length) {
        const { error: oe } = await supabase
          .from("deskline_event_occurrences")
          .insert(uniq);
        if (oe) console.error(`occurrences insert ${id}:`, oe);
        else occurrenceCount += uniq.length;
      }
    } catch (err) {
      console.error(
        `fetchOccurrences ${id} error:`,
        err instanceof Error ? err.message : err,
      );
    }
  });

  console.log(
    `Deskline: inserted ${occurrenceCount} occurrences across ${recurringRefs.length} recurring events`,
  );
  return eventRows.length;
}

// ---------- CONTENT PAGES (jesolo.it via plugin, natale.jesolo.it via crawl) ----------

type PageInput = {
  external_id?: string | number | null;
  url: string;
  lang?: string | null;
  title: string;
  html?: string | null;
  text?: string | null;
  modified?: string | null;
};

function decodeAllEntities(s: string): string {
  return decodeHtmlEntities(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&apos;/g, "'")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&hellip;/g, "…")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—")
    .replace(/&euro;/g, "€");
}

// HTML → readable plain text: drops scripts, styles, navigation and footer,
// keeps paragraph/heading/list breaks.
function htmlToText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(head|header|footer|nav)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|h[1-6]|li|ul|ol|tr|table|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  return decodeAllEntities(cleaned)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLang(lang?: string | null): string {
  const l = (lang ?? "it").toLowerCase().slice(0, 2);
  return /^[a-z]{2}$/.test(l) ? l : "it";
}

async function processSitePages(
  supabase: any,
  site: string,
  pages: PageInput[],
  syncedAt: string,
): Promise<number> {
  if (!Array.isArray(pages) || !pages.length) return 0;
  const rows: Record<string, any>[] = [];
  const seen = new Set<string>();
  for (const p of pages) {
    if (!p?.url || !p?.title) continue;
    const text = p.text?.trim() || (p.html ? htmlToText(p.html) : "");
    if (text.length < MIN_PAGE_TEXT_LENGTH) continue;
    const lang = normalizeLang(p.lang);
    let key = p.external_id != null ? String(p.external_id) : "";
    if (!key) {
      try {
        key = new URL(p.url).pathname;
      } catch {
        key = p.url;
      }
    }
    const id = `${site}:${lang}:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const modified = p.modified ? new Date(p.modified) : null;
    rows.push({
      id,
      site,
      lang,
      url: p.url,
      title: decodeAllEntities(stripHtml(p.title) ?? p.title).trim(),
      content: text,
      external_id: p.external_id != null ? String(p.external_id) : null,
      source_modified_at: modified && !Number.isNaN(modified.getTime())
        ? modified.toISOString()
        : null,
      synced_at: syncedAt,
    });
  }
  if (!rows.length) return 0;
  // Pages are fully re-sent each run: plain upsert (no merge needed).
  for (let i = 0; i < rows.length; i += 50) {
    const { error } = await supabase
      .from("site_pages")
      .upsert(rows.slice(i, i + 50), { onConflict: "id", defaultToNull: false });
    if (error) throw error;
  }
  return rows.length;
}

// Removes pages of `site` not refreshed by the run that started at `runStartedAt`
// (deleted or unpublished at the source).
async function pruneStale(
  supabase: any,
  table: "site_pages" | "site_events",
  site: string,
  runStartedAt: string,
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .delete()
    .eq("site", site)
    .lt("synced_at", runStartedAt)
    .select("id");
  if (error) throw error;
  return (data ?? []).length;
}

// ---------- natale.jesolo.it ----------

const CONTENT_HEADERS = {
  "accept": "text/html,application/xhtml+xml",
  "user-agent": "JesoloWizardSync/1.0",
};

function pathLang(path: string): "it" | "en" | "de" {
  if (path === "/en" || path.startsWith("/en/")) return "en";
  if (path === "/de" || path.startsWith("/de/")) return "de";
  return "it";
}

function extractInternalPaths(html: string, base: string): string[] {
  const out = new Set<string>();
  for (const m of html.matchAll(/href="([^"#?]*)"/g)) {
    let href = m[1];
    if (href.startsWith(base)) href = href.slice(base.length) || "/";
    if (!href.startsWith("/") || href.startsWith("//")) continue;
    if (href.startsWith("/assets") || href.startsWith("/__")) continue;
    if (/\.[a-z0-9]{2,5}$/i.test(href)) continue; // files (png, css, xml…)
    if (EXCLUDED_PATHS.test(href)) continue;
    out.add(href.length > 1 ? href.replace(/\/+$/, "") : href);
  }
  return [...out];
}

function pageTitle(html: string): string {
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return decodeAllEntities(t).replace(/\s*\|\s*Jesolo\.it\s*$/i, "").trim();
}

// Reads a small static site from its start paths, following internal links.
async function crawlSite(
  base: string,
  startPaths: string[],
): Promise<{ pages: PageInput[]; htmlByPath: Map<string, string> }> {
  const queue = [...startPaths];
  const seen = new Set<string>(queue);
  const pages: PageInput[] = [];
  const htmlByPath = new Map<string, string>();

  while (queue.length && htmlByPath.size < NATALE_MAX_PAGES) {
    const path = queue.shift()!;
    const url = `${base}${path === "/" ? "/" : path}`;
    let html: string;
    try {
      const res = await fetch(url, { headers: CONTENT_HEADERS });
      if (!res.ok) {
        await res.body?.cancel();
        console.warn(`${base}${path} → HTTP ${res.status}`);
        continue;
      }
      html = await res.text();
    } catch (err) {
      console.warn(`${base}${path} → ${errorMessage(err)}`);
      continue;
    }
    htmlByPath.set(path, html);
    pages.push({
      url,
      lang: pathLang(path),
      title: pageTitle(html) || path,
      html,
    });
    for (const next of extractInternalPaths(html, base)) {
      if (!seen.has(next)) {
        seen.add(next);
        queue.push(next);
      }
    }
  }
  if (!pages.length) throw new Error(`${base}: no page could be read`);
  return { pages, htmlByPath };
}

const MONTHS: Record<string, number> = {
  gennaio: 1, febbraio: 2, marzo: 3, aprile: 4, maggio: 5, giugno: 6,
  luglio: 7, agosto: 8, settembre: 9, ottobre: 10, novembre: 11, dicembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
  januar: 1, februar: 2, märz: 3, maerz: 3, mai: 5, juni: 6, juli: 7,
  oktober: 10, dezember: 12,
};

function parseLongDate(s: string): string | null {
  const m = s.match(/(\d{1,2})\.?\s+([\p{L}]+)\s+(\d{4})/u);
  if (!m) return null;
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${String(month).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
}

function parseTime(s: string): string | null {
  const m = s.match(/(\d{1,2})[.:](\d{2})/);
  return m ? `${m[1].padStart(2, "0")}:${m[2]}` : null;
}

type NataleEventRaw = {
  date: string | null;
  time: string | null;
  category: string | null;
  title: string;
  place: string | null;
  description: string | null;
};

// Parses the event list of natale.jesolo.it/eventi: each <li> has a left
// column (date span, optional "ore 10.00", category) and a right column
// (title span, place, optional description).
function parseNataleEvents(html: string): NataleEventRaw[] {
  const out: NataleEventRaw[] = [];
  for (const li of html.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const cols = [...li[1].matchAll(/<div\b[^>]*>([\s\S]*?)<\/div>/gi)].map((c) => c[1]);
    if (cols.length < 2) continue;
    const [left, right] = cols;
    const text = (s?: string) => (s ? decodeAllEntities(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim() : "");
    const leftSpan = text(left.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    const date = parseLongDate(leftSpan);
    if (!date) continue;
    const leftPs = [...left.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
    let time: string | null = null;
    let category: string | null = null;
    for (const p of leftPs) {
      const value = text(p[2]);
      const t = /\d{1,2}[.:]\d{2}/.test(value) ? parseTime(value) : null;
      if (t && !time) time = t;
      else if (!category && value) category = value;
    }
    const title = text(right.match(/<span\b[^>]*>([\s\S]*?)<\/span>/i)?.[1]);
    if (!title) continue;
    const rightPs = [...right.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((p) => text(p[1]));
    out.push({
      date,
      time,
      category,
      title,
      place: rightPs[0] || null,
      description: rightPs.slice(1).join(" ") || null,
    });
  }
  return out;
}

async function stableId(...parts: string[]): Promise<string> {
  const data = new TextEncoder().encode(parts.join("|"));
  const digest = await crypto.subtle.digest("SHA-1", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 24);
}

async function processNataleEvents(
  supabase: any,
  htmlByPath: Map<string, string>,
  syncedAt: string,
): Promise<number> {
  const itHtml = htmlByPath.get("/eventi");
  if (!itHtml) throw new Error("natale.jesolo.it/eventi not found");
  const itEvents = parseNataleEvents(itHtml);
  if (!itEvents.length) throw new Error("natale.jesolo.it/eventi: no events parsed (page layout changed?)");

  // EN/DE pages list the same events in the same order: pair them by index
  // only when the counts match.
  const translated: Record<string, NataleEventRaw[] | null> = {};
  for (const lang of ["en", "de"]) {
    const h = htmlByPath.get(`/${lang}/eventi`);
    const evs = h ? parseNataleEvents(h) : [];
    translated[lang] = evs.length === itEvents.length ? evs : null;
    if (h && !translated[lang]) {
      console.warn(`natale events: ${lang} list has ${evs.length} items vs ${itEvents.length} in it — skipping ${lang} texts`);
    }
  }

  const rows: Record<string, any>[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < itEvents.length; i++) {
    const e = itEvents[i];
    const id = await stableId(NATALE_SITE, e.date!, e.time ?? "", e.title.toLowerCase());
    if (seen.has(id)) continue;
    seen.add(id);
    const i18n = (pick: (x: NataleEventRaw) => string | null) => {
      const o: Record<string, string> = {};
      const it = pick(e);
      if (it) o.it = it;
      for (const lang of ["en", "de"]) {
        const v = translated[lang] ? pick(translated[lang]![i]) : null;
        if (v) o[lang] = v;
      }
      return o;
    };
    rows.push({
      id,
      site: NATALE_SITE,
      event_date: e.date,
      start_time: e.time,
      title: e.title,
      title_i18n: i18n((x) => x.title),
      category_i18n: i18n((x) => x.category),
      place_i18n: i18n((x) => x.place),
      description_i18n: i18n((x) => x.description),
      url: `${NATALE_BASE}/eventi`,
      url_i18n: { it: `${NATALE_BASE}/eventi`, en: `${NATALE_BASE}/en/eventi`, de: `${NATALE_BASE}/de/eventi` },
      synced_at: syncedAt,
    });
  }
  return saveSiteEvents(supabase, NATALE_SITE, rows, syncedAt);
}

// Upserts the full event list of a content site and drops the events the
// site no longer lists.
async function saveSiteEvents(
  supabase: any,
  site: string,
  rows: Record<string, any>[],
  syncedAt: string,
): Promise<number> {
  const { error } = await supabase.from("site_events").upsert(rows, { onConflict: "id", defaultToNull: false });
  if (error) throw error;
  const removed = await pruneStale(supabase, "site_events", site, syncedAt);
  console.log(`${site} events: ${rows.length} upserted, ${removed} removed`);
  return rows.length;
}

// ---------- lightson.jesolo.it ----------
// One-page site: section#programma lists one <article> per venue with name,
// description (+ "Guest(s): 25 dic · Name, …"), optional note, rows of
// dates per month ("Dic" + boxes "Sab 5") and links (website first).

const WEEKDAYS: Record<string, number> = {
  dom: 0, lun: 1, mar: 2, mer: 3, gio: 4, ven: 5, sab: 6,
  sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6,
};
const SHORT_MONTHS: Record<string, number> = {
  gen: 1, feb: 2, mar: 3, apr: 4, mag: 5, giu: 6, lug: 7, ago: 8, set: 9, ott: 10, nov: 11, dic: 12,
  jan: 1, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, dec: 12,
};

type VenueRaw = {
  name: string;
  description: string;
  note: string | null;
  guests: Map<string, string>; // "MM-DD" → guest names
  dates: { month: number; day: number; weekday: number | null }[];
  url: string | null;
};

function plainText(html: string): string {
  return decodeAllEntities(html.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function parseLightsOnVenues(html: string): VenueRaw[] {
  const start = html.indexOf('id="programma"');
  if (start < 0) return [];
  const section = html.slice(start, html.indexOf("</section>", start) + 1 || undefined);
  const venues: VenueRaw[] = [];
  for (const a of section.matchAll(/<article\b[\s\S]*?<\/article>/gi)) {
    const art = a[0];
    const name = plainText(art.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? "");
    if (!name) continue;
    const paragraphs = [...art.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)];
    const isMonthLabel = (attrs: string) => /tracking-widest/.test(attrs);
    const textPs = paragraphs.filter((p) => !isMonthLabel(p[1])).map((p) => plainText(p[2]));
    const [first = "", ...rest] = textPs;
    const [descLine, ...guestLines] = first.split("\n");
    const guests = new Map<string, string>();
    for (const line of guestLines) {
      const list = line.replace(/^guests?\s*:\s*/i, "");
      // "25 dic · Name" (it) or "Dec 25 · Name" (en), comma-separated.
      for (const part of list.split(/,\s*(?=\d|[\p{L}]{3}\.?\s+\d)/u)) {
        const m = part.match(/^(?:(\d{1,2})\s+([\p{L}]+)|([\p{L}]+)\.?\s+(\d{1,2}))\.?\s*·\s*(.+)$/u);
        if (!m) continue;
        const day = m[1] ?? m[4];
        const month = SHORT_MONTHS[(m[2] ?? m[3]).toLowerCase().slice(0, 3)];
        if (month) guests.set(`${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`, m[5].trim());
      }
    }
    // Month rows: a label <p> followed by its day boxes.
    const dates: VenueRaw["dates"] = [];
    const rowRe = /<p\b[^>]*tracking-widest[^>]*>\s*([\p{L}]+)\s*<\/p>([\s\S]*?)(?=<p\b[^>]*tracking-widest|<a\b|$)/giu;
    for (const row of art.matchAll(rowRe)) {
      const month = SHORT_MONTHS[row[1].toLowerCase().slice(0, 3)];
      if (!month) continue;
      for (const d of row[2].matchAll(/<span\b[^>]*>\s*([\p{L}]+)\s*<\/span>\s*<span\b[^>]*>\s*(\d{1,2})\s*<\/span>/giu)) {
        dates.push({ month, day: Number(d[2]), weekday: WEEKDAYS[d[1].toLowerCase().slice(0, 3)] ?? null });
      }
    }
    const url = art.match(/<a\b[^>]*href="(https?:[^"]+)"/i)?.[1] ?? null;
    venues.push({
      name,
      description: descLine.trim(),
      note: rest.filter(Boolean).join(" ") || null,
      guests,
      dates,
      url: url ? decodeAllEntities(url) : null,
    });
  }
  return venues;
}

// The programme shows day/month/weekday but no year: pick the year (around
// today) whose calendar matches the weekday shown.
function resolveYear(month: number, day: number, weekday: number | null, today = new Date()): number {
  const y = today.getUTCFullYear();
  const candidates = [y, y + 1, y - 1];
  if (weekday != null) {
    const match = candidates.find((c) => new Date(Date.UTC(c, month - 1, day)).getUTCDay() === weekday);
    if (match) return match;
  }
  // No weekday: the season runs Dec–Jan, so January belongs to next year.
  return month < 6 && today.getUTCMonth() >= 6 ? y + 1 : y;
}

async function processLightsOnEvents(
  supabase: any,
  htmlByPath: Map<string, string>,
  syncedAt: string,
): Promise<number> {
  const itHtml = htmlByPath.get("/");
  if (!itHtml) throw new Error("lightson.jesolo.it home page not read");
  const itVenues = parseLightsOnVenues(itHtml);
  const dateCount = itVenues.reduce((n, v) => n + v.dates.length, 0);
  if (!dateCount) throw new Error("lightson.jesolo.it: no dates parsed (page layout changed?)");

  const enHtml = htmlByPath.get("/en");
  const enVenues = enHtml ? parseLightsOnVenues(enHtml) : [];
  const en = enVenues.length === itVenues.length ? enVenues : null;
  if (enHtml && !en) console.warn(`lightson: en has ${enVenues.length} venues vs ${itVenues.length} in it — skipping en texts`);

  const rows: Record<string, any>[] = [];
  const seen = new Set<string>();
  for (let v = 0; v < itVenues.length; v++) {
    const it = itVenues[v];
    const enV = en?.[v];
    for (const d of it.dates) {
      const year = resolveYear(d.month, d.day, d.weekday);
      const date = `${year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
      const guest = it.guests.get(date.slice(5));
      const id = await stableId(LIGHTSON_SITE, date, it.name.toLowerCase());
      if (seen.has(id)) continue;
      seen.add(id);
      const describe = (x: VenueRaw) => [x.description, x.note].filter(Boolean).join(" ");
      const title = (x: VenueRaw) => (guest ? `${x.name} · ${x.guests.get(date.slice(5)) ?? guest}` : x.name);
      rows.push({
        id,
        site: LIGHTSON_SITE,
        event_date: date,
        start_time: null,
        title: title(it),
        title_i18n: enV ? { it: title(it), en: title(enV) } : { it: title(it) },
        category_i18n: { it: "Lights On · serate e Capodanno", en: "Lights On · nights and New Year's Eve" },
        place_i18n: { it: it.name, en: enV?.name ?? it.name },
        description_i18n: enV ? { it: describe(it), en: describe(enV) } : { it: describe(it) },
        url: it.url ?? `${LIGHTSON_BASE}/`,
        url_i18n: { it: it.url ?? `${LIGHTSON_BASE}/`, en: enV?.url ?? it.url ?? `${LIGHTSON_BASE}/en` },
        synced_at: syncedAt,
      });
    }
  }
  return saveSiteEvents(supabase, LIGHTSON_SITE, rows, syncedAt);
}

// ---------- PUSH from the WordPress plugin ----------

function timingSafeEqual(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) {
    diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  }
  return diff === 0;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const PUSH_HANDLERS: Record<string, (supabase: any, items: any[], syncedAt: string) => Promise<number>> = {
  tribe_categories: (s, items) => processTribeCategories(s, items),
  tribe_events: (s, items) => processTribeEvents(s, items),
  sports_categories: (s, items) => processWpCategories(s, items, "sports_facility_categories"),
  sports_facilities: (s, items) =>
    processWpItems(s, items, "sports_facilities", {
      joinTable: "sports_facility_to_category",
      fkCol: "facility_id",
      taxKey: "categoria_strutture_sportive",
    }),
  activity_categories: (s, items) => processWpCategories(s, items, "activity_categories"),
  activities: (s, items) =>
    processWpItems(s, items, "activities", {
      joinTable: "activity_to_category",
      fkCol: "activity_id",
      taxKey: "attivita-jesolo-category",
    }),
  bike_pages: async (s, items) => {
    const routes = await processWpItems(s, items, "bike_routes");
    const tours = await processBikeTours(s, items);
    console.log(`bike_pages: ${routes} routes, ${tours} tours`);
    return tours;
  },
  beach_establishments: (s, items) => processWpItems(s, items, "beach_establishments"),
  pages: (s, items, syncedAt) => processSitePages(s, WORDPRESS_SITE, items, syncedAt),
};

async function handlePush(req: Request, supabase: any, providedKey: string): Promise<Response> {
  if (!WP_SYNC_KEY) return json({ ok: false, error: "WP_SYNC_KEY is not configured on Supabase" }, 503);
  if (!timingSafeEqual(providedKey.trim(), WP_SYNC_KEY)) return json({ ok: false, error: "Invalid sync key" }, 401);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }
  const kind = String(body?.kind ?? "");
  if (kind === "ping") return json({ ok: true, message: "Connection OK" });

  const handler = PUSH_HANDLERS[kind];
  if (!handler) return json({ ok: false, error: `Unknown kind: ${kind}` }, 400);
  const items = Array.isArray(body?.items) ? body.items : null;
  if (!items) return json({ ok: false, error: "items must be an array" }, 400);

  // All batches of one plugin run share run_started_at, so pages not
  // re-sent by that run can be pruned when the last batch arrives.
  const runStartedAt = typeof body?.run_started_at === "string" && !Number.isNaN(Date.parse(body.run_started_at))
    ? new Date(body.run_started_at).toISOString()
    : new Date().toISOString();
  const source = kind === "pages" ? `pages:${WORDPRESS_SITE}` : kind;
  const started = new Date().toISOString();
  try {
    const count = await handler(supabase, items, runStartedAt);
    let removed = 0;
    if (kind === "pages" && body?.final === true) {
      removed = await pruneStale(supabase, "site_pages", WORDPRESS_SITE, runStartedAt);
    }
    // Pages arrive in several batches: log only the last one.
    if (kind !== "pages" || body?.final === true) {
      await logSync(supabase, `push:${source}`, "success", count, null, started);
    }
    return json({ ok: true, kind, count, removed });
  } catch (e) {
    const msg = errorMessage(e);
    console.error(`Push ${kind} failed:`, msg);
    await logSync(supabase, `push:${source}`, "error", 0, msg, started);
    return json({ ok: false, kind, error: msg }, 500);
  }
}

// ---------- ENTRYPOINT ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const pushKey = req.headers.get("x-wizard-sync-key");
  if (pushKey !== null) return handlePush(req, supabase, pushKey);

  let options: any = {};
  try {
    options = await req.json();
  } catch {
    // cron / manual calls may have no body
  }

  const results: Record<string, any> = {};
  const runStartedAt = new Date().toISOString();
  let nataleHtml: Map<string, string> | null = null;
  let lightsonHtml: Map<string, string> | null = null;

  const sources: Array<[string, () => Promise<number>]> = [];
  if (options?.include_wordpress === true) {
    // Legacy pull from jesolo.it — normally blocked by SiteGround's CAPTCHA;
    // the WordPress plugin pushes this data instead.
    sources.push(
      ["tribe_categories", () => syncTribeCategories(supabase)],
      ["tribe_events", () => syncTribeEvents(supabase)],
      ["sports_categories", () => syncWpCategories(supabase, SPORTS_CATEGORIES_URL, "sports_facility_categories")],
      ["sports_facilities", () =>
        syncWpItems(supabase, SPORTS_FACILITIES_URL, "sports_facilities", {
          joinTable: "sports_facility_to_category",
          fkCol: "facility_id",
          taxKey: "categoria_strutture_sportive",
        })],
      ["activity_categories", () => syncWpCategories(supabase, ACTIVITY_CATEGORIES_URL, "activity_categories")],
      ["activities", () =>
        syncWpItems(supabase, ACTIVITIES_URL, "activities", {
          joinTable: "activity_to_category",
          fkCol: "activity_id",
          taxKey: "attivita-jesolo-category",
        })],
      ["bike_routes", () => syncWpItems(supabase, BIKE_ROUTES_URL, "bike_routes")],
      ["bike_tours", () => syncBikeTours(supabase)],
      ["beach_establishments", () => syncWpItems(supabase, BEACH_ESTABLISHMENTS_URL, "beach_establishments")],
    );
  }
  sources.push(
    [`pages:${NATALE_SITE}`, async () => {
      const { pages, htmlByPath } = await crawlSite(NATALE_BASE, ["/", "/en", "/de"]);
      nataleHtml = htmlByPath;
      const count = await processSitePages(supabase, NATALE_SITE, pages, runStartedAt);
      const removed = await pruneStale(supabase, "site_pages", NATALE_SITE, runStartedAt);
      console.log(`natale pages: ${count} stored, ${removed} removed`);
      return count;
    }],
    [`events:${NATALE_SITE}`, () => {
      if (!nataleHtml) throw new Error("natale.jesolo.it pages were not read");
      return processNataleEvents(supabase, nataleHtml, runStartedAt);
    }],
    [`pages:${LIGHTSON_SITE}`, async () => {
      const { pages, htmlByPath } = await crawlSite(LIGHTSON_BASE, ["/", "/en"]);
      lightsonHtml = htmlByPath;
      const count = await processSitePages(supabase, LIGHTSON_SITE, pages, runStartedAt);
      const removed = await pruneStale(supabase, "site_pages", LIGHTSON_SITE, runStartedAt);
      console.log(`lightson pages: ${count} stored, ${removed} removed`);
      return count;
    }],
    [`events:${LIGHTSON_SITE}`, () => {
      if (!lightsonHtml) throw new Error("lightson.jesolo.it pages were not read");
      return processLightsOnEvents(supabase, lightsonHtml, runStartedAt);
    }],
    ["deskline_events", () => syncDeskline(supabase)],
  );

  for (const [name, fn] of sources) {
    const started = new Date().toISOString();
    try {
      const count = await fn();
      results[name] = { ok: true, count };
      await logSync(supabase, name, "success", count, null, started);
    } catch (e) {
      const msg = errorMessage(e);
      console.error(`Sync ${name} failed:`, msg);
      results[name] = { ok: false, error: msg };
      await logSync(supabase, name, "error", 0, msg, started);
    }
  }

  return json({ ok: true, results });
});
