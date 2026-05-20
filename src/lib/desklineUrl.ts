const SEGMENTS: Record<string, { prefix: string; segment: string }> = {
  it: { prefix: "", segment: "eventi" },
  en: { prefix: "/en", segment: "events" },
  de: { prefix: "/de", segment: "veranstaltungen" },
};

export function buildDesklineEventUrl(
  id: string | null | undefined,
  slug: string | null | undefined,
  lang: string | null | undefined,
): string | undefined {
  if (!id || !slug) return undefined;
  const key = (lang || "it").toLowerCase().slice(0, 2);
  const { prefix, segment } = SEGMENTS[key] ?? SEGMENTS.it;
  return `https://jesolo.it${prefix}/eventi/tutti-gli-eventi/#/${segment}/TRN/${id}/${slug}`;
}

export function localizeJesoloUrl(
  url: string | null | undefined,
  lang: string | null | undefined,
): string | undefined {
  if (!url) return undefined;
  const key = (lang || "it").toLowerCase().slice(0, 2);
  if (key !== "en" && key !== "de") return url;
  try {
    const u = new URL(url, "https://jesolo.it");
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "jesolo.it") return url;
    if (/^\/(en|de|it)(\/|$)/.test(u.pathname)) return u.toString();
    u.pathname = `/${key}${u.pathname.startsWith("/") ? "" : "/"}${u.pathname}`;
    return u.toString();
  } catch {
    return url;
  }
}

export function localizeDesklineEventUrl(
  url: string | null | undefined,
  lang: string | null | undefined,
): string | undefined {
  if (!url) return url ?? undefined;
  const key = (lang || "it").toLowerCase().slice(0, 2);
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host !== "jesolo.it") return url;
    const pathMatch = u.pathname.match(/^\/(?:en|de|it)?\/?eventi\/tutti-gli-eventi\/?$/);
    const hashMatch = u.hash.match(/^#\/(eventi|events|veranstaltungen)\/(.+)$/);
    if (!pathMatch || !hashMatch) return url;
    const { prefix, segment } = SEGMENTS[key] ?? SEGMENTS.it;
    return `https://jesolo.it${prefix}/eventi/tutti-gli-eventi/#/${segment}/${hashMatch[2]}`;
  } catch {
    return url;
  }
}