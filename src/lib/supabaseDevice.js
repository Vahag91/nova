import { createClient } from '@supabase/supabase-js';
import { SUPABASE_BASE, SUPABASE_ANON_KEY } from '../config/endpoints';

// Create a Supabase client that tags requests with the current device id.
export function createSbWithDevice(deviceId) {
  return createClient(SUPABASE_BASE, SUPABASE_ANON_KEY, {
    global: { headers: { 'X-Device-Id': deviceId } },
  });
}

// Fetch coin balance for this device from the 'coins_balance' table.
export async function fetchBalanceByDevice(sb, deviceId) {
  const { data, error } = await sb
    .from('coins_balance')
    .select('balance')
    .eq('device_id', deviceId)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const balance = data?.balance ?? 0;
  return balance;
}
