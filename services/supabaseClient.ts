
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_KEY } from '../constants';

// Initialize the Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
