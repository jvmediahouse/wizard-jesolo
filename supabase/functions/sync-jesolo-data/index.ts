// Sync Jesolo tourism data: Tribe Events, WP sports/activities, Deskline events
// Runs daily via pg_cron, idempotent via upsert.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

const WORDPRESS_HEADERS = {
  "accept": "application/json, text/plain, */*",
  "user-agent": "Mozilla/5.0 (compatible; JesoloWizardSync/1.0)",
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

  const { error } = await supabase.from(table).upsert(merged, { onConflict: pk });
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
  if (!all.length) return 0;
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
  const venuesMap = new Map<number, any>();
  const eventCats: { event_id: number; category_id: number }[] = [];
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
  if (!all.length) return 0;
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
  const { joinTable, fkCol, taxKey } = options;
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
  if (!all.length) return 0;

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

  const results: Record<string, any> = {};
  const sources: Array<[string, () => Promise<number>]> = [
    ["tribe_categories", () => syncTribeCategories(supabase)],
    ["tribe_events", () => syncTribeEvents(supabase)],
    [
      "sports_categories",
      () =>
        syncWpCategories(
          supabase,
          SPORTS_CATEGORIES_URL,
          "sports_facility_categories",
        ),
    ],
    [
      "sports_facilities",
      () =>
        syncWpItems(supabase, SPORTS_FACILITIES_URL, "sports_facilities", {
          joinTable: "sports_facility_to_category",
          fkCol: "facility_id",
          taxKey: "categoria_strutture_sportive",
        }),
    ],
    [
      "activity_categories",
      () =>
        syncWpCategories(
          supabase,
          ACTIVITY_CATEGORIES_URL,
          "activity_categories",
        ),
    ],
    ["activities", () =>
      syncWpItems(supabase, ACTIVITIES_URL, "activities", {
        joinTable: "activity_to_category",
        fkCol: "activity_id",
        taxKey: "attivita-jesolo-category",
      })],
    [
      "bike_routes",
      () => syncWpItems(supabase, BIKE_ROUTES_URL, "bike_routes"),
    ],
    ["bike_tours", () => syncBikeTours(supabase)],
    [
      "beach_establishments",
      () =>
        syncWpItems(supabase, BEACH_ESTABLISHMENTS_URL, "beach_establishments"),
    ],
    ["deskline_events", () => syncDeskline(supabase)],
  ];

  for (const [name, fn] of sources) {
    const started = new Date().toISOString();
    try {
      const count = await fn();
      results[name] = { ok: true, count };
      await logSync(supabase, name, "success", count, null, started);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`Sync ${name} failed:`, msg);
      results[name] = { ok: false, error: msg };
      await logSync(supabase, name, "error", 0, msg, started);
    }
  }

  return new Response(JSON.stringify({ ok: true, results }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
