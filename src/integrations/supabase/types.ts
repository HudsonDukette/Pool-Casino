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
      multiplayer_rooms: {
        Row: {
          id: string
          game_id: string
          created_by: string
          bet_amount: number
          max_players: number
          status: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          created_by: string
          bet_amount: number
          max_players: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          created_by?: string
          bet_amount?: number
          max_players?: number
          status?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      multiplayer_room_players: {
        Row: {
          id: string
          room_id: string
          user_id: string
          status: string
          score: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          status?: string
          score?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          status?: string
          score?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_room_players_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      multiplayer_game_results: {
        Row: {
          id: string
          room_id: string
          user_id: string
          position: number
          payout: number
          created_at: string
        }
        Insert: {
          id?: string
          room_id: string
          user_id: string
          position: number
          payout?: number
          created_at?: string
        }
        Update: {
          id?: string
          room_id?: string
          user_id?: string
          position?: number
          payout?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "multiplayer_game_results_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "multiplayer_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      player_casinos: {
        Row: {
          id: string
          owner_id: string
          name: string
          description: string | null
          theme: string
          house_edge: number
          min_bet: number
          max_bet: number
          bankroll: number
          initial_bankroll: number
          status: string
          enabled_games: string[]
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          owner_id: string
          name: string
          description?: string | null
          theme?: string
          house_edge?: number
          min_bet?: number
          max_bet?: number
          bankroll?: number
          initial_bankroll?: number
          status?: string
          enabled_games?: string[]
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          owner_id?: string
          name?: string
          description?: string | null
          theme?: string
          house_edge?: number
          min_bet?: number
          max_bet?: number
          bankroll?: number
          initial_bankroll?: number
          status?: string
          enabled_games?: string[]
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      casino_members: {
        Row: {
          id: string
          casino_id: string
          user_id: string
          role: string
          joined_at: string
        }
        Insert: {
          id?: string
          casino_id: string
          user_id: string
          role?: string
          joined_at?: string
        }
        Update: {
          id?: string
          casino_id?: string
          user_id?: string
          role?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_members_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "player_casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      casino_bets: {
        Row: {
          id: string
          casino_id: string
          user_id: string
          game_type: string
          option: string
          bet_amount: number
          payout: number
          result: string
          multiplier: number | null
          created_at: string
        }
        Insert: {
          id?: string
          casino_id: string
          user_id: string
          game_type: string
          option: string
          bet_amount: number
          payout?: number
          result: string
          multiplier?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          casino_id?: string
          user_id?: string
          game_type?: string
          option?: string
          bet_amount?: number
          payout?: number
          result?: string
          multiplier?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "casino_bets_casino_id_fkey"
            columns: ["casino_id"]
            isOneToOne: false
            referencedRelation: "player_casinos"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          recipient_id: string | null
          room_id: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          room_id?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          recipient_id?: string | null
          room_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_room_members: {
        Row: {
          created_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "chat_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          is_private: boolean
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          is_private?: boolean
          name?: string
          slug?: string
        }
        Relationships: []
      }
      donations: {
        Row: {
          amount: number
          created_at: string
          from_user_id: string
          id: string
          message: string
          request_id: string | null
          to_user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          from_user_id: string
          id?: string
          message?: string
          request_id?: string | null
          to_user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_user_id?: string
          id?: string
          message?: string
          request_id?: string | null
          to_user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "donations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "money_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
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
      money_requests: {
        Row: {
          amount: number
          audience: string
          created_at: string
          filled_amount: number
          id: string
          note: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          audience?: string
          created_at?: string
          filled_amount?: number
          id?: string
          note?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          audience?: string
          created_at?: string
          filled_amount?: number
          id?: string
          note?: string
          status?: string
          updated_at?: string
          user_id?: string
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
          donated_total: number
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
          received_total: number
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
          donated_total?: number
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
          received_total?: number
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
          donated_total?: number
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
          received_total?: number
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
      can_view_room: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      change_username: { Args: { _new_username: string }; Returns: Json }
      dm_messages: {
        Args: { _limit?: number; _other_user_id: string }
        Returns: {
          avatar_url: string
          body: string
          created_at: string
          id: string
          sender_id: string
          username: string
        }[]
      }
      donate_coins: {
        Args: {
          _amount: number
          _message?: string
          _request_id?: string
          _to_username: string
        }
        Returns: Json
      }
      is_owner: { Args: { _user_id: string }; Returns: boolean }
      is_room_member: {
        Args: { _room_id: string; _user_id: string }
        Returns: boolean
      }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
      leaderboard_stats: {
        Args: { _limit?: number; _period?: string }
        Returns: {
          avatar_url: string
          balance: number
          donated: number
          games: number
          level: number
          max_bet: number
          most_lost: number
          most_won: number
          net_lost: number
          net_made: number
          username: string
          wins: number
        }[]
      }
      my_friends: {
        Args: never
        Returns: {
          avatar_url: string
          direction: string
          status: string
          user_id: string
          username: string
        }[]
      }
      my_transactions: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          created_at: string
          description: string
          kind: string
        }[]
      }
      open_money_requests: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          audience: string
          avatar_url: string
          created_at: string
          filled_amount: number
          id: string
          note: string
          status: string
          username: string
        }[]
      }
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
      room_messages: {
        Args: { _limit?: number; _room_id: string }
        Returns: {
          avatar_url: string
          body: string
          created_at: string
          id: string
          sender_id: string
          username: string
        }[]
      }
      search_players: {
        Args: { _limit?: number; _q: string }
        Returns: {
          avatar_url: string
          user_id: string
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
