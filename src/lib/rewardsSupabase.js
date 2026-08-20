import { v4 as uuidv4 } from 'uuid';
import { ensureDeviceId } from './deviceId';
import { createSbWithDevice } from './supabaseDevice';

// Calls edge function `dynamic-processor`
// Request:  { rewardId, jobId, cost?, type: 'reward' }
// Response: { ok, message?, charged?, granted?, balance? }
export async function redeemReward(rewardId, { jobId, cost } = {}) {
  if (!rewardId) {
    throw new Error('rewardId is required');
  }

  try {
    const deviceId = await ensureDeviceId();
    const sb = createSbWithDevice(deviceId);
    const finalJobId = jobId || uuidv4();
    
    // Send reward redemption info - type: 'reward' tells edge function this is a reward redemption
    // and it should grant credits without checking/charging backend coins
    const requestBody = { 
      rewardId, 
      jobId: finalJobId,
      type: 'reward', // Indicates this is a reward redemption, not a coin spend
      ...(cost !== undefined && { cost }), // Optional: send cost for logging/validation
    };

    const { data, error } = await sb.functions.invoke('dynamic-processor', {
      body: requestBody,
    });

    if (error) {
      throw error;
    }

    if (!data) {
      console.warn('[redeemReward] No data returned from edge function');
    }

    const result = { ...data, jobId: finalJobId, deviceId };
    return result;
  } catch (err) {
    throw err;
  }
}