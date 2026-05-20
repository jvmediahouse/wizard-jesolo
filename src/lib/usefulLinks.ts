import type { UserData } from '@/hooks/useWizard';

const SPORTS_URLS: Record<string, string> = {
  it: 'https://jesolo.it/sport/',
  en: 'https://jesolo.it/en/sport/',
  de: 'https://jesolo.it/de/sport/',
};
const SPORTS_LINK_LABEL: Record<string, string> = {
  it: 'Visita la pagina per sapere di più sulle attività sportive',
  en: 'Visit the page to learn more about sports activities',
  de: 'Besuche die Seite, um mehr über Sportaktivitäten zu erfahren',
};

const LIFESTYLE_URLS: Record<string, string> = {
  it: 'https://jesolo.it/lifestyle/',
  en: 'https://jesolo.it/en/lifestyle/',
  de: 'https://jesolo.it/de/lifestyle/',
};
const LIFESTYLE_LINK_LABEL: Record<string, string> = {
  it: 'Scopri tutti i centri wellness',
  en: 'Discover all wellness centres',
  de: 'Alle Wellness-Center entdecken',
};

const FOOD_URLS: Record<string, string> = {
  it: 'https://jesolo.it/food-beverage/',
  en: 'https://jesolo.it/en/food-beverage/',
  de: 'https://jesolo.it/de/food-beverage/',
};
const FOOD_LINK_LABEL: Record<string, string> = {
  it: 'Scopri dove mangiare e le eccellenze enogastronomiche di Jesolo',
  en: 'Discover dining and food & wine experiences in Jesolo',
  de: 'Entdecke die kulinarischen Highlights und Restaurants von Jesolo',
};

const CICLOTURISMO_URLS: Record<string, string> = {
  it: 'https://jesolo.it/cicloturismo/',
  en: 'https://jesolo.it/en/cicloturismo/',
  de: 'https://jesolo.it/de/cicloturismo/',
};
const CICLOTURISMO_LINK_LABEL: Record<string, string> = {
  it: 'Scopri tutti gli itinerari',
  en: 'Discover all cycling routes',
  de: 'Alle Radtouren entdecken',
};

const PET_BEACH_URLS: Record<string, string> = {
  it: 'https://jesolo.it/beach/',
  en: 'https://jesolo.it/en/beach/',
  de: 'https://jesolo.it/de/beach/',
};
const PET_BEACH_LINK_LABEL: Record<string, string> = {
  it: 'Elenco di tutte le spiagge pet friendly',
  en: 'List of all pet-friendly beaches',
  de: 'Liste aller tierfreundlichen Strände',
};
const BEACH_LINK_LABEL: Record<string, string> = {
  it: 'Scopri le spiagge e gli stabilimenti balneari di Jesolo',
  en: 'Discover the beaches and beach establishments of Jesolo',
  de: 'Entdecke die Strände und Strandeinrichtungen von Jesolo',
};

const TRIPS_URLS: Record<string, string> = {
  it: 'https://jesolo.it/around-jesolo/',
  en: 'https://jesolo.it/en/around-jesolo/',
  de: 'https://jesolo.it/de/around-jesolo/',
};
const TRIPS_LINK_LABEL: Record<string, string> = {
  it: 'Scopri cosa vedere nei dintorni di Jesolo',
  en: 'Discover what to see near Jesolo',
  de: 'Entdecke Ausflugsziele rund um Jesolo',
};

const USEFUL_LINKS_TITLE: Record<string, string> = {
  it: 'Link utili',
  en: 'Useful links',
  de: 'Nützliche Links',
};

const DOVE_DORMIRE_URLS: Record<string, string> = {
  it: 'https://jesolo.it/dove-dormire/',
  en: 'https://jesolo.it/en/dove-dormire/',
  de: 'https://jesolo.it/de/dove-dormire/',
};
const DOVE_DORMIRE_LINK_LABEL: Record<string, string> = {
  it: 'Dove dormire a Jesolo',
  en: 'Where to stay in Jesolo',
  de: 'Übernachten in Jesolo',
};

const INFO_POINT_URLS: Record<string, string> = {
  it: 'https://jesolo.it/info-point/',
  en: 'https://jesolo.it/en/info-point/',
  de: 'https://jesolo.it/de/info-point/',
};
const INFO_POINT_LINK_LABEL: Record<string, string> = {
  it: 'Info Point di Jesolo',
  en: 'Jesolo Info Point',
  de: 'Info Point Jesolo',
};

export interface UsefulLink {
  label: string;
  url: string;
}

export interface UsefulLinksContext {
  sports?: string[];
  lifestyle?: string[];
  interests?: string[];
  hasPet?: boolean | null;
}

function normalizeLang(language?: string): string {
  return (language ?? 'it').split('-')[0].toLowerCase();
}

export function usefulLinksTitle(language?: string): string {
  const lang = normalizeLang(language);
  return USEFUL_LINKS_TITLE[lang] ?? USEFUL_LINKS_TITLE.it;
}

export function buildUsefulLinks(ctx: UsefulLinksContext, language?: string): UsefulLink[] {
  const lang = normalizeLang(language);
  const sports = ctx.sports ?? [];
  const lifestyle = ctx.lifestyle ?? [];
  const interests = ctx.interests ?? [];
  const hasPet = !!ctx.hasPet;

  const links: UsefulLink[] = [];

  const showBeachLink = hasPet || interests.includes('relax');
  if (showBeachLink) {
    links.push({
      label: hasPet
        ? (PET_BEACH_LINK_LABEL[lang] ?? PET_BEACH_LINK_LABEL.it)
        : (BEACH_LINK_LABEL[lang] ?? BEACH_LINK_LABEL.it),
      url: PET_BEACH_URLS[lang] ?? PET_BEACH_URLS.it,
    });
  }
  if (sports.includes('cycling')) {
    links.push({
      label: CICLOTURISMO_LINK_LABEL[lang] ?? CICLOTURISMO_LINK_LABEL.it,
      url: CICLOTURISMO_URLS[lang] ?? CICLOTURISMO_URLS.it,
    });
  }
  if (sports.some((s) => s !== 'cycling')) {
    links.push({
      label: SPORTS_LINK_LABEL[lang] ?? SPORTS_LINK_LABEL.it,
      url: SPORTS_URLS[lang] ?? SPORTS_URLS.it,
    });
  }
  if (lifestyle.includes('wellness')) {
    links.push({
      label: LIFESTYLE_LINK_LABEL[lang] ?? LIFESTYLE_LINK_LABEL.it,
      url: LIFESTYLE_URLS[lang] ?? LIFESTYLE_URLS.it,
    });
  }
  if (lifestyle.includes('food')) {
    links.push({
      label: FOOD_LINK_LABEL[lang] ?? FOOD_LINK_LABEL.it,
      url: FOOD_URLS[lang] ?? FOOD_URLS.it,
    });
  }
  if (interests.includes('trips')) {
    links.push({
      label: TRIPS_LINK_LABEL[lang] ?? TRIPS_LINK_LABEL.it,
      url: TRIPS_URLS[lang] ?? TRIPS_URLS.it,
    });
  }
  return links;
}

export function buildUsefulLinksFromUserData(userData: UserData, language?: string): UsefulLink[] {
  const lang = normalizeLang(language);
  const links = buildUsefulLinks(
    {
      sports: userData.sports,
      lifestyle: userData.lifestyle,
      interests: userData.interests,
      hasPet: userData.hasPet,
    },
    language,
  );
  links.push({
    label: DOVE_DORMIRE_LINK_LABEL[lang] ?? DOVE_DORMIRE_LINK_LABEL.it,
    url: DOVE_DORMIRE_URLS[lang] ?? DOVE_DORMIRE_URLS.it,
  });
  links.push({
    label: INFO_POINT_LINK_LABEL[lang] ?? INFO_POINT_LINK_LABEL.it,
    url: INFO_POINT_URLS[lang] ?? INFO_POINT_URLS.it,
  });
  return links;
}