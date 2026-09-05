import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@vivra/shared/lib/database';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://upjiewrirkzhjeciwugg.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVwamlld3Jpcmt6aGplY2l3dWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEyODA2MTksImV4cCI6MjA4Njg1NjYxOX0.1BP3UOebHR8SIvSBefyhhiQlv-y3DGGtGM-Xsw2bGEw';

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
