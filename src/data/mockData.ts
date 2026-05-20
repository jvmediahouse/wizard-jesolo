// Types kept for backward compat; data now comes from Supabase.
export interface JesoloEvent {
  id: string;
  title: string;
  date: string;
  description: string;
  location: string;
  image?: string;
  url?: string;
}

export interface Experience {
  id: string;
  title: string;
  category: 'beach' | 'sport' | 'restaurant' | 'culture';
  description: string;
  location: string;
}
