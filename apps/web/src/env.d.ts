/// <reference path="../.astro/types.d.ts" />

declare namespace App {
  interface Locals {
    user: import('@supabase/supabase-js').User;
    supabase: import('@supabase/supabase-js').SupabaseClient;
    activePetId: string | null;
  }
}
