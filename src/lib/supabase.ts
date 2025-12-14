import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Service = {
  id: string;
  name: string;
  base_price: string;
  unit: string;
  created_at: string;
};

export type Client = {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
};

export type Budget = {
  id: string;
  client_id: string;
  service_id: string;
  quantity: string;
  distance_km: string;
  difficulty_factor: string;
  total_price: string;
  description: string;
  status: string;
  sent_at: string | null;
  created_at: string;
  clients?: Client;
  services?: Service;
};

export type EmailHistory = {
  id: string;
  budget_id: string;
  type: string;
  content: string;
  sent_at: string;
};
