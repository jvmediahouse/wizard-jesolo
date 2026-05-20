// AI travel-agent for Jesolo: builds a personalized vacation plan from form answers
// using real events/activities pulled from the DB.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

interface UserData {
  name?: string;
  surname?: string;
  email?: string;
  city?: string;
  province?: string;
  country?: string;
  ageRange?: string;
  travelGroup?: string;
  interests?: string[];
  beachPreference?: string;
  sports?: string[];
  eventTypes?: string[];
  lifestyle?: string[];
  selectedDate?: string | null;
  endDate?: string | null;
  path?: string | null;
  hasPet?: boolean | null;
}

const LOG_CHUNK_SIZE = 2000;

function safeStringify(value: unknown): string {
  try {
    return typeof value === "string" ? value : JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function logChunked(label: string, value: unknown, chunkSize = LOG_CHUNK_SIZE) {
  const text = safeStringify(value);
  const total = Math.max(1, Math.ceil(text.length / chunkSize));
  console.log(`[${label}] length=${text.length} chunks=${total}`);
  for (let i = 0; i < total; i++) {
    const start = i * chunkSize;
    const end = start + chunkSize;
    console.log(`[${label}] chunk ${i + 1}/${total}: ${text.slice(start, end)}`);
  }
}

function parseCalendarDate(value?: string | null): Date | null {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day), 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
    const { userData, language = "it" } = await req.json() as { userData: UserData; language?: string };
    if (!userData) {
      return new Response(JSON.stringify({ error: "userData required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Determine date range
    const today = new Date();
    const fallbackDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12, 0, 0, 0);
    const start = parseCalendarDate(userData.selectedDate) ?? fallbackDate;
    const requestedEnd = parseCalendarDate(userData.endDate);
    const end = requestedEnd && requestedEnd >= start ? requestedEnd : start;
    const startDateOnly = formatDateOnly(start);
    const endDateOnly = formatDateOnly(end);
    const startISO = `${startDateOnly}T00:00:00.000Z`;
    const endExclusive = new Date(end);
    endExclusive.setDate(endExclusive.getDate() + 1);
    const endISO = `${formatDateOnly(endExclusive)}T00:00:00.000Z`;

    // Pull events
    // const { data: tribeEvents } = await supabase
    //   .from("events")
    //   .select("id,title,description,start_date,end_date,url,image_url,venues(name,address,city)")
    //   .gte("start_date", startISO)
    //   .lte("start_date", endISO)
    //   .order("start_date", { ascending: true });

    const [
      desklineEventsResult,
      occurrencesResult,
      activitiesResult,
      sportsResult,
      bikeRoutesResult,
      beachEstablishmentsResult,
      allThemesResult,
    ] = await Promise.all([
      supabase
          .from("deskline_events")
          .select("id,name,name_i18n,date,has_more_dates,place,place_i18n,town,town_i18n,lat,lon,description_short,description_short_i18n,description_full,description_full_i18n,url_friendly_name,url_friendly_name_i18n,web_url,image_url")
          .gte("date", startISO)
          .lte("date", endISO)
          .order("date", { ascending: true }),
      supabase
          .from("deskline_event_occurrences")
          .select("event_id,occurrence_date,start_time,duration,day_of_week,deskline_events(id,name,name_i18n,date,has_more_dates,place,place_i18n,town,town_i18n,lat,lon,description_short,description_short_i18n,description_full,description_full_i18n,url_friendly_name,url_friendly_name_i18n,web_url,image_url)")
          .gte("occurrence_date", startDateOnly)
          .lte("occurrence_date", endDateOnly)
          .order("occurrence_date", { ascending: true })
          .order("start_time", { ascending: true }),
      supabase.from("activities").select("id,title,excerpt,link"),
      supabase.from("sports_facilities").select("id,title,excerpt,link"),
      supabase.from("bike_tours").select("id,title,description,komoot_url,distance_km,duration_min,elevation_m,category,image_url"),
      supabase.from("beach_establishments").select("id,title,excerpt,link"),
      supabase
          .from("deskline_themes")
          .select("name, name_i18n, order")
          .order("order", { ascending: true, nullsFirst: false }),
    ]);

    const queryErrors = [
      desklineEventsResult.error,
      occurrencesResult.error,
      activitiesResult.error,
      sportsResult.error,
      bikeRoutesResult.error,
      beachEstablishmentsResult.error,
      allThemesResult.error,
    ].filter(Boolean);

    if (queryErrors.length > 0) {
      throw new Error(queryErrors.map((error) => error?.message ?? "Unknown query error").join(" | "));
    }

    const desklineEventsBase = desklineEventsResult.data ?? [];
    const occurrences = occurrencesResult.data ?? [];
    const activities = activitiesResult.data ?? [];
    const sports = sportsResult.data ?? [];
    const bikeTours = bikeRoutesResult.data ?? [];
    const beachEstablishments = beachEstablishmentsResult.data ?? [];
    const allThemes = allThemesResult.data ?? [];

    // Collect all deskline event ids we may show, then fetch themes in one query
    const desklineIds = new Set<string>();
    for (const o of (occurrences ?? [])) {
      if (o.event_id) desklineIds.add(String(o.event_id));
    }
    for (const e of (desklineEventsBase ?? [])) {
      if (e.id) desklineIds.add(String(e.id));
    }

    const themesByEvent: Record<string, { name: string; order: number | null }[]> = {};
    if (desklineIds.size > 0) {
      const { data: themesRows } = await supabase
          .from("deskline_event_themes")
          .select("event_id, deskline_themes(name, name_i18n, order)")
          .in("event_id", Array.from(desklineIds));
      for (const t of (themesRows ?? []) as any[]) {
        const langKey0 = (language || "it").split("-")[0].toLowerCase();
        const i18nName = t.deskline_themes?.name_i18n;
        const name = (i18nName && typeof i18nName === "object"
          ? (i18nName[langKey0] ?? i18nName.it ?? i18nName.en ?? i18nName.de)
          : null) ?? t.deskline_themes?.name;
        if (!t.event_id || !name) continue;
        const key = String(t.event_id);
        (themesByEvent[key] ||= []).push({
          name,
          order: typeof t.deskline_themes?.order === "number" ? t.deskline_themes.order : null,
        });
      }
      // Sort each event's themes by order asc (nulls last)
      for (const key of Object.keys(themesByEvent)) {
        themesByEvent[key].sort((a, b) => {
          if (a.order == null && b.order == null) return 0;
          if (a.order == null) return 1;
          if (b.order == null) return -1;
          return a.order - b.order;
        });
      }
    }

    const themeNamesFor = (id: string): string[] =>
        (themesByEvent[id] ?? []).map((t) => t.name);

    const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const langKey = (language || "it").split("-")[0].toLowerCase();
    const pickI18n = (i18nObj: any, fallback: any): any => {
      if (i18nObj && typeof i18nObj === "object") {
        return i18nObj[langKey] ?? i18nObj.it ?? i18nObj.en ?? i18nObj.de ?? fallback;
      }
      return fallback;
    };

    // Merge: prefer recurring occurrences (specific date + time), then add unique base events
    const desklineFromOccs = (occurrences ?? []).map((o: any) => ({
      title: pickI18n(o.deskline_events?.name_i18n, o.deskline_events?.name),
      date: o.occurrence_date,
      day_of_week: typeof o.day_of_week === "number" ? DOW[o.day_of_week] : null,
      start_time: o.start_time,
      duration_minutes: o.duration,
      place: pickI18n(o.deskline_events?.place_i18n, o.deskline_events?.place),
      town: pickI18n(o.deskline_events?.town_i18n, o.deskline_events?.town),
      lat: o.deskline_events?.lat,
      lon: o.deskline_events?.lon,
      url: o.deskline_events?.web_url,
      image: o.deskline_events?.image_url ?? null,
      summary: (pickI18n(o.deskline_events?.description_short_i18n, o.deskline_events?.description_short) || ""),
      description: (pickI18n(o.deskline_events?.description_full_i18n, o.deskline_events?.description_full) || ""),
      themes: themeNamesFor(String(o.event_id)),
      recurring: true,
    })).filter((e: any) => e.title);

    const occEventIds = new Set((occurrences ?? []).map((o: any) => o.event_id));
    const desklineFromBase = (desklineEventsBase ?? [])
        .filter((e: any) => !occEventIds.has(e.id))
        .map((e: any) => ({
          title: pickI18n(e.name_i18n, e.name),
          date: e.date,
          place: pickI18n(e.place_i18n, e.place),
          town: pickI18n(e.town_i18n, e.town),
          lat: e.lat,
          lon: e.lon,
          url: e.web_url,
          image: e.image_url ?? null,
          summary: (pickI18n(e.description_short_i18n, e.description_short) || ""),
          description: (pickI18n(e.description_full_i18n, e.description_full) || ""),
          themes: themeNamesFor(String(e.id)),
          has_more_dates: !!e.has_more_dates,
          recurring: false,
        }));

    const context = {
      preferences: userData,
      dates: { from: startDateOnly, to: endDateOnly },
      available_themes: allThemes.map((t: any) => pickI18n(t.name_i18n, t.name)),
      local_restrictions: {
        forbidden_suggestions: [
          "biking on the beach/sandy shoreline",
          "dog bathing/swimming in the sea",
          "diving or jumping from piers/pontoons",
        ],
        compliance_note: "These activities are prohibited in Jesolo and must never be suggested.",
      },
      events_deskline: [...desklineFromOccs, ...desklineFromBase],
      activities: activities.map((a: any) => ({
        title: a.title,
        summary: (a.excerpt || ""),
        url: a.link,
      })),
      sports: sports.map((s: any) => ({
        title: s.title,
        summary: (s.excerpt || ""),
        url: s.link,
      })),
      bike_tours: bikeTours.map((t: any) => ({
        title: t.title,
        summary: t.description || "",
        url: t.komoot_url,
        distance_km: t.distance_km,
        duration_min: t.duration_min,
        elevation_m: t.elevation_m,
        category: t.category,
        image: t.image_url,
      })),
      beach_establishments: beachEstablishments.map((establishment: any) => ({
        title: establishment.title,
        summary: (establishment.excerpt || ""),
        url: establishment.link,
      })),
    };

    const langName = language === "en" ? "English" : language === "de" ? "German" : "Italian";

    const systemPrompt = `You are an expert travel concierge for the official Jesolo tourism portal (jesolo.it). You know Jesolo, the Lido, the Venetian lagoon, and the surrounding area (Venice, Treviso, Cavallino-Treporti) inside out.

Your task: build a personalized, realistic vacation plan based on the user's preferences. Never invent events, venues, or names.

Rules:
- Output language: ${langName}. Write everything (titles, descriptions, tips) in ${langName}.
- DO NOT recommend any specific restaurant, pizzeria, gelateria, hotel, B&B, agriturismo, or named accommodation. Never mention a place by name for eating or sleeping.
- Tone: warm, professional, enthusiastic — like a knowledgeable local concierge.
- For food, speak only in general categories and zones (e.g. "a seafood trattoria along the lungomare", "a pizzeria in the historic centre", "a gelateria near Piazza Mazzini").
- COVER EVERY SINGLE DAY of the user's date range, in chronological order — never skip a day.
- Include practical tips (approximate timing, how to get there, free vs paid when known) but never invent prices.
- If no event or activites are avaiable or don't fit, you can fill the remaining slots with generic and relevant seaside activities typical of a Jesolo beach holiday — for example: a walk along Via Bafile or the seafront promenade (lungomare), renting a rickshaw or a pedal boat (pattino/moscone), a sunset aperitivo on the beach, a bike ride along the Lido, sandcastle time with kids, or other classic beach-town pastimes
- You may use the provided bike_tours and beach establishments when they genuinely match the user's profile and dates. They are optional sources, EXCEPT: if userData.sports includes "cycling", you MUST propose at least one item from bike_tours during the stay, picking the SPECIFIC tour that best fits the user: for families / with kids / short trips prefer category="easy-family" and distance_km <= 12; for sport-focused or day-trip willing users prefer category="gravel" or "loop" with longer distances.
- Never invent named cycling routes, beach clubs, venues, or event details beyond the supplied data.
- Do not repeat the same named event more than ONCE in the whole itinerary, unless it has a clearly different date/time occurrence and strong relevance.
- Generic beach/leisure activities are NOT considered named events and can be repeated across days, but vary the wording and context (e.g. beach relax, promenade walk, sunset aperitivo, bike by the seafront).

 EVENTS LIST RULES (events array renders as cards with image + title + meta + link):
 - Whenever you reference a concrete named event from events_deskline, ALSO add a structured entry to that day's "events" array with title, time (when available), location, url and image — copy url and image verbatim from the source event. Do not invent URLs or images.
 - Whenever you recommend a bike tour from bike_tours, ALSO add a structured entry to that day's "events" array: title = the tour's exact title, url = its komoot url (verbatim), image = its image (verbatim, if present), location = a compact meta string built from its stats, e.g. "10 km · 1h30" or "23 km · 2h10 · gravel" (use distance_km and duration_min; format duration as "Xh" or "XhYY"; include category only when meaningful). OMIT the "time" field for bike tours.
 - Keep slot.content concise: do not repeat the event/tour name, url or image inside slot text — the card renders all of that. For a bike tour, the slot text should be a short narrative like "Pedalata mattutina lungo la laguna — vedi il tour consigliato qui sotto." and nothing more.
 - If an event has no specific start time, or its start time is 00:00, OMIT the "time" field entirely — the UI will label it as all-day.

INTERESTS GLOSSARY (interpret userData.interests keys):
- "sport": sports & outdoor (cycling, outdoor sports, water sports, golf, indoor fitness, karting). If userData.sports is provided, prioritise those sub-types.
- "relax": beach & relaxation; use userData.beachPreference (equipped vs free) to bias suggestions.
- "culture": cultural events; if userData.eventTypes is provided (folklore, concerts, sport, culture), weight suggestions accordingly.
- "nightlife": nightlife & entertainment (bars, clubs, beachfront aperitivo, lungomare evenings).
- "bleisure": work + leisure for solo travellers; include coworking-friendly spots, calmer mornings, leisure afternoons.
- "lifestyle": food & wine, shopping, wellness/spa. If userData.lifestyle is provided (food, shopping, wellness), weight suggestions accordingly — still no named restaurants or hotels.
- "trips": day-trips and half-day excursions around Jesolo — Venice, Burano, Murano, Treviso, Padova, Verona, Vicenza, the Dolomites, the Venetian lagoon and hinterland. Include at least one trip when the stay is long enough. Whenever you plan a day-trip, add a closing sentence in the slot content inviting the user to scroll to the bottom of the page and check the link with all nearby itineraries and destinations.

LEGAL & LOCAL RESTRICTIONS (NON-NEGOTIABLE):
- Treat all restrictions in local_restrictions.forbidden_suggestions as strictly forbidden.
- If user preferences conflict with restrictions, prioritize restrictions and provide compliant alternatives.
- If hasPet=true, include only compliant pet-friendly ideas; never suggest prohibited pet activities.
- Never mention prohibited activities even as optional ideas.

SLOT COMPOSITION RULES — follow these strictly:
1. STANDARD DAY: 2 or 3 slots using any combination of "morning", "afternoon", "evening".
2. FULL-DAY activity: use EXACTLY ONE slot with time_of_day "full-day". No other slots for that day.
3. LIGHT/RECOVERY DAY: use only 1 or 2 slots.
4. After any full-day or physically demanding activity, the NEXT day must be a light day.
5. NEVER combine "full-day" with any other slot in the same day.

- Return ONLY valid JSON matching the tool schema.`;

    const userPrompt = `You will receive structured data about a tourist. Your task is to:
1. First interpret the user profile.
2. Then select only relevant activities/events for this user profile and date range; since this is a Jesolo holiday, beach-friendly activities are always welcome.
3. Respect local_restrictions strictly. If hasPet=true, include only compliant pet-friendly suggestions.
4. Slot text must stay concise (1-2 short sentences) and use clean plain text only — no emojis, pictograms, bullets, decorative symbols, or icon-like prefixes..
5. Then build a realistic itinerary adapted to that profile.
\n\n${JSON.stringify(context, null, 2)}`;

    logChunked("System prompt", systemPrompt);
    logChunked("User prompt", userPrompt);
    console.log("Calling OpenAI API...");

    const tools = [{
      type: "function",
      function: {
        name: "vacation_plan",
        description: "Personalized Jesolo vacation plan",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string" },
            introduction: { type: "string", description: "Personal welcoming intro (2-4 sentences)" },
            days: {
              type: "array",
              description: "Day-by-day itinerary",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  title: { type: "string" },
                  slots: {
                    type: "array",
                    description: "1–3 slots by day. Use 'full-day' alone for full-day activities. Use 'morning'/'afternoon'/'evening' for standard days. Reduce to 1–2 on light/recovery days.",
                    items: {
                      type: "object",
                      properties: {
                        time_of_day: {
                          type: "string",
                          enum: ["morning", "afternoon", "evening", "full-day"],
                          description: "'full-day' must be the only slot of the day.",
                        },
                        content: {
                          type: "string",
                          description: "Description of the activity, including practical tips, timing.",
                        },
                      },
                      required: ["time_of_day", "content"],
                      additionalProperties: false,
                    },
                    minItems: 1,
                    maxItems: 3,
                  },
                  events: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        time: { type: "string" },
                        location: { type: "string" },
                        url: { type: "string" },
                        image: { type: "string", description: "Thumbnail image URL — copy verbatim from the matching event in events_deskline; omit if none." },
                      },
                      required: ["title"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["date", "title", "slots"],
                additionalProperties: false,
              },
            },
          },
          required: ["title", "introduction", "days"],
          additionalProperties: false,
        },
      },
    }];

    const openAiBody = {
      model: "gpt-5.4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      tools,
      tool_choice: { type: "function", function: { name: "vacation_plan" } },
    };

    logChunked("OpenAI request body", openAiBody);

    const openAiUrl = "https://api.openai.com/v1/chat/completions";
    const openAiHeaders = {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    };

    const aiRes = await fetch(openAiUrl, {
      method: "POST",
      headers: openAiHeaders,
      body: JSON.stringify(openAiBody),
    });

    if (!aiRes.ok) {
      const t = await aiRes.text();
      console.error("OpenAI error status:", aiRes.status);
      logChunked("OpenAI error body", t);
      return new Response(JSON.stringify({ error: "AI service error", detail: t.slice(0, 500) }), {
        status: aiRes.status === 429 ? 429 : 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiRes.json();
    console.log("OpenAI response status:", aiRes.status);
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      logChunked("No tool call message", aiData.choices?.[0]?.message);
      return new Response(JSON.stringify({ error: "No plan generated" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const plan = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ plan }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("generate-vacation-plan error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
