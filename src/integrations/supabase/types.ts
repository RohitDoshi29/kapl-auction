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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      match_history: {
        Row: {
          created_at: string
          current_innings: number
          group: string
          id: string
          innings1: Json | null
          innings2: Json | null
          match_type: string
          status: string
          team1_id: string
          team2_id: string
          tournament_id: string | null
          winner: string | null
        }
        Insert: {
          created_at?: string
          current_innings?: number
          group: string
          id: string
          innings1?: Json | null
          innings2?: Json | null
          match_type?: string
          status?: string
          team1_id: string
          team2_id: string
          tournament_id?: string | null
          winner?: string | null
        }
        Update: {
          created_at?: string
          current_innings?: number
          group?: string
          id?: string
          innings1?: Json | null
          innings2?: Json | null
          match_type?: string
          status?: string
          team1_id?: string
          team2_id?: string
          tournament_id?: string | null
          winner?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_history_team1_id_fkey"
            columns: ["team1_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_history_team2_id_fkey"
            columns: ["team2_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
        ]
      }
      match_state: {
        Row: {
          current_match: Json | null
          id: string
          last_action: Json | null
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          current_match?: Json | null
          id?: string
          last_action?: Json | null
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          current_match?: Json | null
          id?: string
          last_action?: Json | null
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      secondary_match_state: {
        Row: {
          current_match: Json | null
          id: string
          last_action: Json | null
          updated_at: string
        }
        Insert: {
          current_match?: Json | null
          id?: string
          last_action?: Json | null
          updated_at?: string
        }
        Update: {
          current_match?: Json | null
          id?: string
          last_action?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          captain_name: string | null
          captain_player_id: string | null
          captain_user_id: string | null
          created_at: string
          group: string
          id: string
          initial_purse: number
          logo: string | null
          max_squad_size: number
          name: string
          owner_email: string | null
          owner_name: string | null
          owner_user_id: string | null
          player_count: number
          players: Json
          primary_color: string
          remaining_purse: number
          tournament_id: string | null
          updated_at: string
        }
        Insert: {
          captain_name?: string | null
          captain_player_id?: string | null
          captain_user_id?: string | null
          created_at?: string
          group: string
          id: string
          initial_purse?: number
          logo?: string | null
          max_squad_size?: number
          name: string
          owner_email?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          player_count?: number
          players?: Json
          primary_color: string
          remaining_purse?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Update: {
          captain_name?: string | null
          captain_player_id?: string | null
          captain_user_id?: string | null
          created_at?: string
          group?: string
          id?: string
          initial_purse?: number
          logo?: string | null
          max_squad_size?: number
          name?: string
          owner_email?: string | null
          owner_name?: string | null
          owner_user_id?: string | null
          player_count?: number
          players?: Json
          primary_color?: string
          remaining_purse?: number
          tournament_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournaments: {
        Row: {
          category: string
          created_at: string
          edition: string
          id: string
          name: string
          rules: Json
          status: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          edition?: string
          id: string
          name: string
          rules?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          edition?: string
          id?: string
          name?: string
          rules?: Json
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      players: {
        Row: {
          auction_status: string
          base_price: number
          batting_style: string | null
          bowling_style: string | null
          created_at: string
          id: string
          jersey_number: number | null
          mobile_number: string | null
          name: string
          photo_url: string | null
          role: string
          sold_price: number | null
          team_id: string | null
          tournament_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          auction_status?: string
          base_price?: number
          batting_style?: string | null
          bowling_style?: string | null
          created_at?: string
          id?: string
          jersey_number?: number | null
          mobile_number?: string | null
          name: string
          photo_url?: string | null
          role?: string
          sold_price?: number | null
          team_id?: string | null
          tournament_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          auction_status?: string
          base_price?: number
          batting_style?: string | null
          bowling_style?: string | null
          created_at?: string
          id?: string
          jersey_number?: number | null
          mobile_number?: string | null
          name?: string
          photo_url?: string | null
          role?: string
          sold_price?: number | null
          team_id?: string | null
          tournament_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "players_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "players_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_state: {
        Row: {
          bid_history: Json
          current_bid: number
          current_player_id: string | null
          highest_bidder_team_id: string | null
          id: string
          status: string
          timer_ends_at: string | null
          tournament_id: string
          updated_at: string
        }
        Insert: {
          bid_history?: Json
          current_bid?: number
          current_player_id?: string | null
          highest_bidder_team_id?: string | null
          id: string
          status?: string
          timer_ends_at?: string | null
          tournament_id: string
          updated_at?: string
        }
        Update: {
          bid_history?: Json
          current_bid?: number
          current_player_id?: string | null
          highest_bidder_team_id?: string | null
          id?: string
          status?: string
          timer_ends_at?: string | null
          tournament_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_state_current_player_id_fkey"
            columns: ["current_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_state_highest_bidder_team_id_fkey"
            columns: ["highest_bidder_team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_state_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      auction_bids: {
        Row: {
          bid_amount: number
          bidder_user_id: string | null
          created_at: string
          id: string
          player_id: string
          team_id: string
          tournament_id: string
        }
        Insert: {
          bid_amount: number
          bidder_user_id?: string | null
          created_at?: string
          id?: string
          player_id: string
          team_id: string
          tournament_id: string
        }
        Update: {
          bid_amount?: number
          bidder_user_id?: string | null
          created_at?: string
          id?: string
          player_id?: string
          team_id?: string
          tournament_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "auction_bids_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_team_id_fkey"
            columns: ["team_id"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "auction_bids_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
        ]
      }
      tournament_state: {
        Row: {
          final_winner: string | null
          id: string
          qualified_a1: string | null
          qualified_a2: string | null
          qualified_b1: string | null
          qualified_b2: string | null
          sf1_winner: string | null
          sf2_winner: string | null
          updated_at: string
        }
        Insert: {
          final_winner?: string | null
          id?: string
          qualified_a1?: string | null
          qualified_a2?: string | null
          qualified_b1?: string | null
          qualified_b2?: string | null
          sf1_winner?: string | null
          sf2_winner?: string | null
          updated_at?: string
        }
        Update: {
          final_winner?: string | null
          id?: string
          qualified_a1?: string | null
          qualified_a2?: string | null
          qualified_b1?: string | null
          qualified_b2?: string | null
          sf1_winner?: string | null
          sf2_winner?: string | null
          updated_at?: string
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
          role?: Database["public"]["Enums"]["app_role"]
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
      is_admin: { Args: never; Returns: boolean }
      is_primary_scorer: { Args: never; Returns: boolean }
      is_secondary_scorer: { Args: never; Returns: boolean }
      reset_all_players_and_teams: { Args: never; Returns: void }
      delete_player_by_id: {
        Args: {
          p_id: string
        }
        Returns: void
      }
      register_new_player: {
        Args: {
          p_base_price?: number
          p_batting_style?: string
          p_bowling_style?: string
          p_id: string
          p_jersey_number?: number | null
          p_mobile_number?: string | null
          p_name: string
          p_photo_url?: string | null
          p_role: string
          p_tournament_id?: string
          p_user_id?: string | null
        }
        Returns: Json
      }
      sell_player_to_team: {
        Args: {
          p_bidder_user_id?: string | null
          p_player_id: string
          p_sold_price: number
          p_team_id: string
          p_tournament_id: string
        }
        Returns: Json
      }
      get_my_private_player_profile: {
        Args: Record<string, never>
        Returns: Json
      }
      get_player_private_details: {
        Args: {
          p_player_id: string
        }
        Returns: Json
      }
      admin_assign_role_by_email: {
        Args: {
          p_email: string
          p_role: Database["public"]["Enums"]["app_role"]
        }
        Returns: Json
      }
      admin_revoke_role_by_email: {
        Args: {
          p_email: string
          p_role?: Database["public"]["Enums"]["app_role"] | null
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "co_admin" | "user" | "primary_scorer" | "secondary_scorer" | "captain" | "owner" | "player"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "co_admin", "user", "primary_scorer", "secondary_scorer", "captain", "owner", "player"],
    },
  },
} as const
