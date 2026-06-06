import { createClient } from '@supabase/supabase-js';
import {
  RC_WEBHOOK_URL,
  SUPABASE_BASE,
  SUPABASE_ANON_KEY,
} from '../config/endpoints';

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

export async function grantReviewerCoins(deviceId) {
  const response = await fetch(RC_WEBHOOK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      apikey: SUPABASE_ANON_KEY,
      'X-Device-Id': String(deviceId),
    },
    body: JSON.stringify({
      action: 'grant_reviewer_coins',
      device_id: deviceId,
    }),
  });

  let body = null;
  try {
    body = await response.json();
  } catch {}

  if (!response.ok) {
    const error = new Error(body?.error || 'Unable to grant reviewer coins.');
    error.code = body?.error || 'reviewer_grant_failed';
    throw error;
  }

  if (typeof body?.balance !== 'number') {
    const error = new Error('Reviewer grant returned no coin balance.');
    error.code = 'reviewer_balance_missing';
    throw error;
  }

  return body.balance;
}
