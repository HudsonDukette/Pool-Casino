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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bets: {
        Row: {
          bet_amount: number
          created_at: string
          game_type: string
          id: string
          metadata: Json | null
          multiplier: number | null
          payout: number
          result: string
          user_id: string
        }
        Insert: {
          bet_amount: number
          created_at?: string
          game_type: string
          id?: string
          metadata?: Json | null
          multiplier?: number | null
          payout: number
          result: string
          user_id: string
        }
        Update: {
          bet_amount?: number
          created_at?: string
          game_type?: string
          id?: string
          metadata?: Json | null
          multiplier?: number | null
          payout?: number
          result?: string
          user_id?: string
        }
        Relationships: []
      }
      money_ledger: {
        Row: {
          actor_user_id: string | null
          amount: number
          created_at: string
          description: string
          direction: string
          event_type: string
          id: string
          target_user_id: string | null
        }
        Insert: {
          actor_user_id?: string | null
          amount: number
          created_at?: string
          description?: string
          direction: string
          event_type: string
          id?: string
          target_user_id?: string | null
        }
        Update: {
          actor_user_id?: string | null
          amount?: number
          created_at?: string
          description?: string
          direction?: string
          event_type?: string
          id?: string
          target_user_id?: string | null
        }
        Relationships: []
      }
      pool: {
        Row: {
          biggest_bet: number
          biggest_win: number
          created_at: string
          disabled_games: string[]
          id: number
          pool_paused: boolean
          total_amount: number
          updated_at: string
        }
        Insert: {
          biggest_bet?: number
          biggest_win?: number
          created_at?: string
          disabled_games?: string[]
          id?: number
          pool_paused?: boolean
          total_amount?: number
          updated_at?: string
        }
        Update: {
          biggest_bet?: number
          biggest_win?: number
          created_at?: string
          disabled_games?: string[]
          id?: number
          pool_paused?: boolean
          total_amount?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          balance: number
          ban_reason: string | null
          banned_until: string | null
          biggest_bet: number
          biggest_win: number
          bio: string | null
          created_at: string
          current_streak: number
          email: string | null
          games_played: number
          id: string
          is_admin: boolean
          is_banned: boolean
          is_owner: boolean
          is_perma_banned: boolean
          is_suspended: boolean
          last_bet_at: string | null
          last_daily_claim: string | null
          level: number
          total_losses: number
          total_profit: number
          total_wins: number
          updated_at: string
          user_id: string
          username: string
          win_streak: number
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          balance?: number
          ban_reason?: string | null
          banned_until?: string | null
          biggest_bet?: number
          biggest_win?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          email?: string | null
          games_played?: number
          id?: string
          is_admin?: boolean
          is_banned?: boolean
          is_owner?: boolean
          is_perma_banned?: boolean
          is_suspended?: boolean
          last_bet_at?: string | null
          last_daily_claim?: string | null
          level?: number
          total_losses?: number
          total_profit?: number
          total_wins?: number
          updated_at?: string
          user_id: string
          username: string
          win_streak?: number
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          balance?: number
          ban_reason?: string | null
          banned_until?: string | null
          biggest_bet?: number
          biggest_win?: number
          bio?: string | null
          created_at?: string
          current_streak?: number
          email?: string | null
          games_played?: number
          id?: string
          is_admin?: boolean
          is_banned?: boolean
          is_owner?: boolean
          is_perma_banned?: boolean
          is_suspended?: boolean
          last_bet_at?: string | null
          last_daily_claim?: string | null
          level?: number
          total_losses?: number
          total_profit?: number
          total_wins?: number
          updated_at?: string
          user_id?: string
          username?: string
          win_streak?: number
          xp?: number
        }
        Relationships: []
      }
      settings: {
        Row: {
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      change_username: { Args: { _new_username: string }; Returns: Json }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      public_leaderboard: {
        Args: { _limit?: number }
        Returns: {
          avatar_url: string
          biggest_win: number
          games_played: number
          level: number
          total_profit: number
          total_wins: number
          username: string
        }[]
      }
      public_profile: {
        Args: { _username: string }
        Returns: {
          avatar_url: string
          biggest_bet: number
          biggest_win: number
          bio: string
          created_at: string
          current_streak: number
          games_played: number
          level: number
          total_losses: number
          total_profit: number
          total_wins: number
          username: string
          win_streak: number
          xp: number
        }[]
      }
      public_profile_bets: {
        Args: { _limit?: number; _username: string }
        Returns: {
          bet_amount: number
          created_at: string
          game_type: string
          multiplier: number
          payout: number
          result: string
        }[]
      }
      public_recent_wins: {
        Args: { _limit?: number }
        Returns: {
          created_at: string
          game_type: string
          multiplier: number
          payout: number
          username: string
        }[]
      }
      settle_bet: {
        Args: {
          _bet_amount: number
          _game_type: string
          _metadata?: Json
          _multiplier?: number
          _payout: number
          _result?: string
        }
        Returns: Json
      }
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
