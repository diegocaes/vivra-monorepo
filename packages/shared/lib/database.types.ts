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
      activity_logs: {
        Row: {
          created_at: string | null
          date: string
          duration_minutes: number | null
          id: string
          notes: string | null
          pet_id: string | null
          walks: number | null
        }
        Insert: {
          created_at?: string | null
          date: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pet_id?: string | null
          walks?: number | null
        }
        Update: {
          created_at?: string | null
          date?: string
          duration_minutes?: number | null
          id?: string
          notes?: string | null
          pet_id?: string | null
          walks?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      adventures: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          location: string | null
          pet_id: string
          photo_url: string | null
          title: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          location?: string | null
          pet_id: string
          photo_url?: string | null
          title: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          location?: string | null
          pet_id?: string
          photo_url?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "adventures_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      app_events: {
        Row: {
          created_at: string
          event: string
          id: number
          name: string
          platform: string
          props: Json | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: string
          id?: never
          name: string
          platform?: string
          props?: Json | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: string
          id?: never
          name?: string
          platform?: string
          props?: Json | null
          user_id?: string | null
        }
        Relationships: []
      }
      blood_tests: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          pet_id: string
        }
        Insert: {
          created_at?: string | null
          date: string
          id?: string
          notes?: string | null
          pet_id: string
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          pet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "blood_tests_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      flight_documents: {
        Row: {
          created_at: string | null
          file_url: string
          flight_id: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          file_url: string
          flight_id: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          file_url?: string
          flight_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "flight_documents_flight_id_fkey"
            columns: ["flight_id"]
            isOneToOne: false
            referencedRelation: "flights"
            referencedColumns: ["id"]
          },
        ]
      }
      flights: {
        Row: {
          airline: string
          airport_cost: number | null
          cabin_or_cargo: string | null
          chip_verified: boolean | null
          crate_approved: boolean | null
          created_at: string | null
          customs_cost: number | null
          destination: string
          flight_date: string
          flight_number: string | null
          health_certificate: boolean | null
          id: string
          import_permit: boolean | null
          notes: string | null
          origin: string
          paperwork_cost: number | null
          pet_id: string
          ticket_price: number | null
          vaccines_updated: boolean | null
          vet_certificate: boolean | null
        }
        Insert: {
          airline: string
          airport_cost?: number | null
          cabin_or_cargo?: string | null
          chip_verified?: boolean | null
          crate_approved?: boolean | null
          created_at?: string | null
          customs_cost?: number | null
          destination: string
          flight_date: string
          flight_number?: string | null
          health_certificate?: boolean | null
          id?: string
          import_permit?: boolean | null
          notes?: string | null
          origin: string
          paperwork_cost?: number | null
          pet_id: string
          ticket_price?: number | null
          vaccines_updated?: boolean | null
          vet_certificate?: boolean | null
        }
        Update: {
          airline?: string
          airport_cost?: number | null
          cabin_or_cargo?: string | null
          chip_verified?: boolean | null
          crate_approved?: boolean | null
          created_at?: string | null
          customs_cost?: number | null
          destination?: string
          flight_date?: string
          flight_number?: string | null
          health_certificate?: boolean | null
          id?: string
          import_permit?: boolean | null
          notes?: string | null
          origin?: string
          paperwork_cost?: number | null
          pet_id?: string
          ticket_price?: number | null
          vaccines_updated?: boolean | null
          vet_certificate?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "flights_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          amount_grams: number | null
          bag_size: number | null
          bag_unit: string | null
          brand: string
          created_at: string | null
          daily_grams: number | null
          end_date: string | null
          food_type: string | null
          frequency: string | null
          id: string
          notes: string | null
          pet_id: string
          price: number | null
          start_date: string | null
          type: string
        }
        Insert: {
          amount_grams?: number | null
          bag_size?: number | null
          bag_unit?: string | null
          brand: string
          created_at?: string | null
          daily_grams?: number | null
          end_date?: string | null
          food_type?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          pet_id: string
          price?: number | null
          start_date?: string | null
          type: string
        }
        Update: {
          amount_grams?: number | null
          bag_size?: number | null
          bag_unit?: string | null
          brand?: string
          created_at?: string | null
          daily_grams?: number | null
          end_date?: string | null
          food_type?: string | null
          frequency?: string | null
          id?: string
          notes?: string | null
          pet_id?: string
          price?: number | null
          start_date?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "foods_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      groomings: {
        Row: {
          cost: number | null
          created_at: string | null
          date: string
          groomer_name: string | null
          id: string
          location: string | null
          notes: string | null
          pet_id: string
          services: string[]
          type: string
        }
        Insert: {
          cost?: number | null
          created_at?: string | null
          date: string
          groomer_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pet_id: string
          services?: string[]
          type: string
        }
        Update: {
          cost?: number | null
          created_at?: string | null
          date?: string
          groomer_name?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pet_id?: string
          services?: string[]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "groomings_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          dismissed: boolean
          href: string | null
          icon: string | null
          id: string
          message: string
          pet_id: string | null
          read: boolean | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          dismissed?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          message: string
          pet_id?: string | null
          read?: boolean | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          dismissed?: boolean
          href?: string | null
          icon?: string | null
          id?: string
          message?: string
          pet_id?: string | null
          read?: boolean | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      owner_profiles: {
        Row: {
          birth_date: string | null
          created_at: string | null
          first_name: string | null
          gender: string | null
          id: string
          last_name: string | null
          phone: string | null
          user_id: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string | null
          first_name?: string | null
          gender?: string | null
          id?: string
          last_name?: string | null
          phone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      pet_share_invites: {
        Row: {
          accepted_by: string | null
          created_at: string
          expires_at: string
          id: string
          inviter_id: string
          pet_id: string
          status: string
          token: string
        }
        Insert: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id: string
          pet_id: string
          status?: string
          token?: string
        }
        Update: {
          accepted_by?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          inviter_id?: string
          pet_id?: string
          status?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "pet_share_invites_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pet_shares: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          pet_id: string
          role: string
          shared_with: string
          shared_with_email: string | null
          shared_with_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          pet_id: string
          role?: string
          shared_with: string
          shared_with_email?: string | null
          shared_with_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          pet_id?: string
          role?: string
          shared_with?: string
          shared_with_email?: string | null
          shared_with_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pet_shares_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      pets: {
        Row: {
          birth_city: string | null
          birth_country: string | null
          birth_date: string | null
          breed: string | null
          chip_id: string | null
          color: string | null
          created_at: string | null
          gender: string | null
          id: string
          is_neutered: boolean | null
          name: string
          photo_url: string | null
          species: string
          support_type: string | null
          theme_color: string | null
          user_id: string
          vaccine_card_url: string | null
          weight_kg: number | null
        }
        Insert: {
          birth_city?: string | null
          birth_country?: string | null
          birth_date?: string | null
          breed?: string | null
          chip_id?: string | null
          color?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_neutered?: boolean | null
          name: string
          photo_url?: string | null
          species?: string
          support_type?: string | null
          theme_color?: string | null
          user_id: string
          vaccine_card_url?: string | null
          weight_kg?: number | null
        }
        Update: {
          birth_city?: string | null
          birth_country?: string | null
          birth_date?: string | null
          breed?: string | null
          chip_id?: string | null
          color?: string | null
          created_at?: string | null
          gender?: string | null
          id?: string
          is_neutered?: boolean | null
          name?: string
          photo_url?: string | null
          species?: string
          support_type?: string | null
          theme_color?: string | null
          user_id?: string
          vaccine_card_url?: string | null
          weight_kg?: number | null
        }
        Relationships: []
      }
      preventive_treatments: {
        Row: {
          cost: number | null
          created_at: string
          date_given: string
          id: string
          lot_number: string | null
          next_due: string | null
          notes: string | null
          pet_id: string
          product_name: string | null
          type: string
        }
        Insert: {
          cost?: number | null
          created_at?: string
          date_given: string
          id?: string
          lot_number?: string | null
          next_due?: string | null
          notes?: string | null
          pet_id: string
          product_name?: string | null
          type: string
        }
        Update: {
          cost?: number | null
          created_at?: string
          date_given?: string
          id?: string
          lot_number?: string | null
          next_due?: string | null
          notes?: string | null
          pet_id?: string
          product_name?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "preventive_treatments_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string | null
          id: string
          platform: string
          token: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          platform?: string
          token: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          platform?: string
          token?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referral_codes: {
        Row: {
          code: string
          created_at: string | null
          id: string
          user_id: string
          uses_count: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          id?: string
          user_id: string
          uses_count?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          id?: string
          user_id?: string
          uses_count?: number | null
        }
        Relationships: []
      }
      referrals: {
        Row: {
          code: string
          completed_at: string | null
          created_at: string | null
          id: string
          premium_days_granted: number | null
          referred_id: string
          referrer_id: string
          reward_granted: boolean | null
          status: string | null
        }
        Insert: {
          code: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          premium_days_granted?: number | null
          referred_id: string
          referrer_id: string
          reward_granted?: boolean | null
          status?: string | null
        }
        Update: {
          code?: string
          completed_at?: string | null
          created_at?: string | null
          id?: string
          premium_days_granted?: number | null
          referred_id?: string
          referrer_id?: string
          reward_granted?: boolean | null
          status?: string | null
        }
        Relationships: []
      }
      treats: {
        Row: {
          brand: string | null
          created_at: string | null
          id: string
          name: string
          notes: string | null
          pet_id: string
          price: number | null
          purchase_date: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          id?: string
          name: string
          notes?: string | null
          pet_id: string
          price?: number | null
          purchase_date?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          id?: string
          name?: string
          notes?: string | null
          pet_id?: string
          price?: number | null
          purchase_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "treats_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      user_subscriptions: {
        Row: {
          cancel_scheduled_at: string | null
          created_at: string | null
          iap_event_timestamp: number | null
          iap_product_id: string | null
          id: string
          paddle_subscription_id: string | null
          plan: string
          premium_until: string | null
          referral_days_balance: number
          source: string | null
          trial_ends_at: string | null
          updated_at: string | null
          user_id: string
          web_event_id: string | null
          web_event_timestamp: string | null
        }
        Insert: {
          cancel_scheduled_at?: string | null
          created_at?: string | null
          iap_event_timestamp?: number | null
          iap_product_id?: string | null
          id?: string
          paddle_subscription_id?: string | null
          plan?: string
          premium_until?: string | null
          referral_days_balance?: number
          source?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id: string
          web_event_id?: string | null
          web_event_timestamp?: string | null
        }
        Update: {
          cancel_scheduled_at?: string | null
          created_at?: string | null
          iap_event_timestamp?: number | null
          iap_product_id?: string | null
          id?: string
          paddle_subscription_id?: string | null
          plan?: string
          premium_until?: string | null
          referral_days_balance?: number
          source?: string | null
          trial_ends_at?: string | null
          updated_at?: string | null
          user_id?: string
          web_event_id?: string | null
          web_event_timestamp?: string | null
        }
        Relationships: []
      }
      vaccines: {
        Row: {
          brand: string | null
          created_at: string | null
          date_given: string
          id: string
          lot_number: string | null
          name: string
          next_due: string | null
          notes: string | null
          pet_id: string
          vet_name: string | null
        }
        Insert: {
          brand?: string | null
          created_at?: string | null
          date_given: string
          id?: string
          lot_number?: string | null
          name: string
          next_due?: string | null
          notes?: string | null
          pet_id: string
          vet_name?: string | null
        }
        Update: {
          brand?: string | null
          created_at?: string | null
          date_given?: string
          id?: string
          lot_number?: string | null
          name?: string
          next_due?: string | null
          notes?: string | null
          pet_id?: string
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vaccines_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      vet_visits: {
        Row: {
          clinic_name: string | null
          cost: number | null
          created_at: string | null
          date: string
          diagnosis: string | null
          id: string
          location: string | null
          notes: string | null
          pet_id: string
          reason: string
          treatment: string | null
          vet_name: string | null
        }
        Insert: {
          clinic_name?: string | null
          cost?: number | null
          created_at?: string | null
          date: string
          diagnosis?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pet_id: string
          reason: string
          treatment?: string | null
          vet_name?: string | null
        }
        Update: {
          clinic_name?: string | null
          cost?: number | null
          created_at?: string | null
          date?: string
          diagnosis?: string | null
          id?: string
          location?: string | null
          notes?: string | null
          pet_id?: string
          reason?: string
          treatment?: string | null
          vet_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vet_visits_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
      weight_records: {
        Row: {
          created_at: string | null
          date: string
          id: string
          notes: string | null
          pet_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          pet_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string | null
          date?: string
          id?: string
          notes?: string | null
          pet_id?: string
          weight_kg?: number
        }
        Relationships: [
          {
            foreignKeyName: "weight_records_pet_id_fkey"
            columns: ["pet_id"]
            isOneToOne: false
            referencedRelation: "pets"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_pet_share_invite: { Args: { p_token: string }; Returns: Json }
      clear_iap_premium: { Args: never; Returns: undefined }
      expire_my_premium_if_due: { Args: never; Returns: undefined }
      generate_my_referral_code: { Args: { p_base?: string }; Returns: Json }
      generate_referral_code: { Args: { pet_name: string }; Returns: string }
      get_shared_premium_until: { Args: never; Returns: string }
      is_flight_owner: { Args: { p_flight_id: string }; Returns: boolean }
      is_pet_owner: { Args: { p_pet_id: string }; Returns: boolean }
      redeem_referral: { Args: { p_code: string }; Returns: Json }
      set_iap_premium: {
        Args: { p_iap_product_id?: string; p_premium_until: string }
        Returns: undefined
      }
      unaccent: { Args: { "": string }; Returns: string }
      user_can_access_pet:
        | { Args: { p_pet_id: string }; Returns: boolean }
        | { Args: { p_pet_id: string; p_user_id: string }; Returns: boolean }
      validate_referral_code: { Args: { p_code: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
