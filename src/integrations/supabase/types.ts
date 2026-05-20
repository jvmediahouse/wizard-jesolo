export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activities: {
        Row: {
          created_at: string
          description: string | null
          excerpt: string | null
          id: number
          image_url: string | null
          link: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      activity_categories: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id: number
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      activity_to_category: {
        Row: {
          activity_id: number
          category_id: number
        }
        Insert: {
          activity_id: number
          category_id: number
        }
        Update: {
          activity_id?: number
          category_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "activity_to_category_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_to_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "activity_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      beach_establishments: {
        Row: {
          created_at: string
          description: string | null
          excerpt: string | null
          id: number
          image_url: string | null
          link: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bike_routes: {
        Row: {
          created_at: string
          description: string | null
          excerpt: string | null
          id: number
          image_url: string | null
          link: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      bike_tours: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          distance_km: number | null
          duration_min: number | null
          elevation_m: number | null
          id: string
          image_url: string | null
          komoot_url: string
          parent_page_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          distance_km?: number | null
          duration_min?: number | null
          elevation_m?: number | null
          id: string
          image_url?: string | null
          komoot_url: string
          parent_page_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          distance_km?: number | null
          duration_min?: number | null
          elevation_m?: number | null
          id?: string
          image_url?: string | null
          komoot_url?: string
          parent_page_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bike_tours_parent_page_id_fkey"
            columns: ["parent_page_id"]
            isOneToOne: false
            referencedRelation: "bike_routes"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          count: number | null
          created_at: string
          id: number
          name: string
          slug: string | null
          updated_at: string
        }
        Insert: {
          count?: number | null
          created_at?: string
          id: number
          name: string
          slug?: string | null
          updated_at?: string
        }
        Update: {
          count?: number | null
          created_at?: string
          id?: number
          name?: string
          slug?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      deskline_event_occurrences: {
        Row: {
          created_at: string
          day_of_week: number | null
          duration: number | null
          event_id: string
          id: string
          occurrence_date: string
          start_time: string | null
        }
        Insert: {
          created_at?: string
          day_of_week?: number | null
          duration?: number | null
          event_id: string
          id?: string
          occurrence_date: string
          start_time?: string | null
        }
        Update: {
          created_at?: string
          day_of_week?: number | null
          duration?: number | null
          event_id?: string
          id?: string
          occurrence_date?: string
          start_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deskline_event_occurrences_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "deskline_events"
            referencedColumns: ["id"]
          },
        ]
      }
      deskline_event_themes: {
        Row: {
          event_id: string
          theme_id: string
        }
        Insert: {
          event_id: string
          theme_id: string
        }
        Update: {
          event_id?: string
          theme_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deskline_event_themes_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "deskline_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deskline_event_themes_theme_id_fkey"
            columns: ["theme_id"]
            isOneToOne: false
            referencedRelation: "deskline_themes"
            referencedColumns: ["id"]
          },
        ]
      }
      deskline_events: {
        Row: {
          created_at: string
          date: string | null
          description_full: string | null
          description_full_i18n: Json | null
          description_short: string | null
          description_short_i18n: Json | null
          has_more_dates: boolean | null
          id: string
          image_url: string | null
          lat: number | null
          lon: number | null
          name: string
          name_i18n: Json | null
          place: string | null
          place_i18n: Json | null
          town: string | null
          town_i18n: Json | null
          updated_at: string
          url_friendly_name: string | null
          url_friendly_name_i18n: Json | null
          web_url: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          description_full?: string | null
          description_full_i18n?: Json | null
          description_short?: string | null
          description_short_i18n?: Json | null
          has_more_dates?: boolean | null
          id: string
          image_url?: string | null
          lat?: number | null
          lon?: number | null
          name: string
          name_i18n?: Json | null
          place?: string | null
          place_i18n?: Json | null
          town?: string | null
          town_i18n?: Json | null
          updated_at?: string
          url_friendly_name?: string | null
          url_friendly_name_i18n?: Json | null
          web_url?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          description_full?: string | null
          description_full_i18n?: Json | null
          description_short?: string | null
          description_short_i18n?: Json | null
          has_more_dates?: boolean | null
          id?: string
          image_url?: string | null
          lat?: number | null
          lon?: number | null
          name?: string
          name_i18n?: Json | null
          place?: string | null
          place_i18n?: Json | null
          town?: string | null
          town_i18n?: Json | null
          updated_at?: string
          url_friendly_name?: string | null
          url_friendly_name_i18n?: Json | null
          web_url?: string | null
        }
        Relationships: []
      }
      deskline_themes: {
        Row: {
          id: string
          name: string
          name_i18n: Json | null
          order: number | null
          updated_at: string
        }
        Insert: {
          id: string
          name: string
          name_i18n?: Json | null
          order?: number | null
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          name_i18n?: Json | null
          order?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      event_categories: {
        Row: {
          category_id: number
          event_id: number
        }
        Insert: {
          category_id: number
          event_id: number
        }
        Update: {
          category_id?: number
          event_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "event_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_categories_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          all_day: boolean | null
          cost: string | null
          created_at: string
          description: string | null
          end_date: string | null
          excerpt: string | null
          featured: boolean | null
          id: number
          image_url: string | null
          kid_friendly: boolean | null
          slug: string | null
          start_date: string | null
          title: string
          updated_at: string
          url: string | null
          venue_id: number | null
        }
        Insert: {
          all_day?: boolean | null
          cost?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id: number
          image_url?: string | null
          kid_friendly?: boolean | null
          slug?: string | null
          start_date?: string | null
          title: string
          updated_at?: string
          url?: string | null
          venue_id?: number | null
        }
        Update: {
          all_day?: boolean | null
          cost?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          excerpt?: string | null
          featured?: boolean | null
          id?: number
          image_url?: string | null
          kid_friendly?: boolean | null
          slug?: string | null
          start_date?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          venue_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "events_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      sports_facilities: {
        Row: {
          created_at: string
          description: string | null
          excerpt: string | null
          id: number
          image_url: string | null
          link: string | null
          slug: string | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          excerpt?: string | null
          id?: number
          image_url?: string | null
          link?: string | null
          slug?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      sports_facility_categories: {
        Row: {
          created_at: string
          id: number
          name: string
          slug: string | null
        }
        Insert: {
          created_at?: string
          id: number
          name: string
          slug?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          name?: string
          slug?: string | null
        }
        Relationships: []
      }
      sports_facility_to_category: {
        Row: {
          category_id: number
          facility_id: number
        }
        Insert: {
          category_id: number
          facility_id: number
        }
        Update: {
          category_id?: number
          facility_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "sports_facility_to_category_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "sports_facility_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sports_facility_to_category_facility_id_fkey"
            columns: ["facility_id"]
            isOneToOne: false
            referencedRelation: "sports_facilities"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_log: {
        Row: {
          error: string | null
          finished_at: string | null
          id: number
          records_synced: number | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          error?: string | null
          finished_at?: string | null
          id?: number
          records_synced?: number | null
          source: string
          started_at?: string
          status: string
        }
        Update: {
          error?: string | null
          finished_at?: string | null
          id?: number
          records_synced?: number | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          id: number
          name: string
          phone: string | null
          province: string | null
          slug: string | null
          updated_at: string
          url: string | null
          website: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id: number
          name: string
          phone?: string | null
          province?: string | null
          slug?: string | null
          updated_at?: string
          url?: string | null
          website?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          id?: number
          name?: string
          phone?: string | null
          province?: string | null
          slug?: string | null
          updated_at?: string
          url?: string | null
          website?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      wizard_submissions: {
        Row: {
          age_range: string | null
          beach_preference: string | null
          city: string | null
          country: string | null
          created_at: string
          email: string | null
          end_date: string | null
          event_types: string[] | null
          generated_plan: Json | null
          has_pet: boolean | null
          id: string
          interests: string[] | null
          name: string | null
          newsletter: boolean | null
          path: string | null
          privacy_consent: boolean | null
          province: string | null
          selected_date: string | null
          sports: string[] | null
          surname: string | null
          travel_group: string | null
        }
        Insert: {
          age_range?: string | null
          beach_preference?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          event_types?: string[] | null
          generated_plan?: Json | null
          has_pet?: boolean | null
          id?: string
          interests?: string[] | null
          name?: string | null
          newsletter?: boolean | null
          path?: string | null
          privacy_consent?: boolean | null
          province?: string | null
          selected_date?: string | null
          sports?: string[] | null
          surname?: string | null
          travel_group?: string | null
        }
        Update: {
          age_range?: string | null
          beach_preference?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          email?: string | null
          end_date?: string | null
          event_types?: string[] | null
          generated_plan?: Json | null
          has_pet?: boolean | null
          id?: string
          interests?: string[] | null
          name?: string | null
          newsletter?: boolean | null
          path?: string | null
          privacy_consent?: boolean | null
          province?: string | null
          selected_date?: string | null
          sports?: string[] | null
          surname?: string | null
          travel_group?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
