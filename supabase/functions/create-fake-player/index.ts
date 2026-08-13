import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const NAME_PARTS = [
  "Shadow", "Neon", "Cyber", "Digital", "Quantum", "Cosmic", "Stellar", "Solar", "Lunar", "Mystic",
  "Dragon", "Phoenix", "Titan", "Apex", "Prime", "Elite", "Master", "Legend", "Hero", "Champion",
  "Storm", "Thunder", "Lightning", "Blaze", "Frost", "Ice", "Fire", "Earth", "Wind", "Water",
  "Crystal", "Plasma", "Atomic", "Nuclear", "Void", "Abyss", "Nexus", "Core", "Flux", "Spark",
  "Rider", "Walker", "Runner", "Hunter", "Seeker", "Finder", "Keeper", "Guardian", "Protector", "Defender"
];

const SUFFIXES = [
  "X", "Pro", "Master", "King", "Queen", "Lord", "God", "Elite", "Prime", "Alpha",
  "Omega", "Zero", "One", "Two", "Three", "Max", "Ultra", "Mega", "Giga", "Tera",
  "99", "88", "77", "66", "55", "44", "33", "22", "11", "00"
];

function generateRandomUsername(): string {
  const numParts = Math.floor(Math.random() * 3) + 2;
  const parts: string[] = [];
  
  for (let i = 0; i < numParts; i++) {
    parts.push(NAME_PARTS[Math.floor(Math.random() * NAME_PARTS.length)]);
  }
  
  if (Math.random() > 0.6) {
    parts.push(SUFFIXES[Math.floor(Math.random() * SUFFIXES.length)]);
  }
  
  return parts.join("");
}

function generateRandomPassword(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
  let password = "";
  for (let i = 0; i < 16; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

function generateFakeEmail(username: string): string {
  const domains = ["fake-casino.com", "bot-player.net", "virtual-gambler.io"];
  const domain = domains[Math.floor(Math.random() * domains.length)];
  return `${username.toLowerCase()}${Math.floor(Math.random() * 1000)}@${domain}`;
}

serve(async (req) => {
  try {
    const { count = 1 } = await req.json()
    
    // Create Supabase client with service role key (available in Edge Functions)
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const createdUsers = []

    for (let i = 0; i < count; i++) {
      try {
        const username = generateRandomUsername()
        const email = generateFakeEmail(username)
        const password = generateRandomPassword()

        // Create auth user
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: {
            username,
            is_fake_player: true,
          },
        })

        if (authError || !authData?.user) {
          console.error("Error creating auth user:", authError)
          continue
        }

        // Create profile
        const initialBalance = Math.floor(Math.random() * 5000) + 1000
        const { error: profileError } = await supabase
          .from("profiles")
          .insert({
            user_id: authData.user.id,
            username,
            email,
            balance: initialBalance,
            is_admin: false,
            is_owner: false,
            is_banned: false,
            is_perma_banned: false,
            is_suspended: false,
            games_played: 0,
            total_wins: 0,
            total_losses: 0,
          })

        if (profileError) {
          console.error("Error creating profile:", profileError)
          await supabase.auth.admin.deleteUser(authData.user.id)
          continue
        }

        createdUsers.push({
          id: authData.user.id,
          username,
          email,
          balance: initialBalance,
        })

      } catch (error) {
        console.error("Error in fake user creation:", error)
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        created: createdUsers.length, 
        users: createdUsers 
      }),
      { headers: { "Content-Type": "application/json" } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : String(error) 
      }),
      { 
        status: 500,
        headers: { "Content-Type": "application/json" } 
      }
    )
  }
})
