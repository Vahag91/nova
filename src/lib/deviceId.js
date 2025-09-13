import { v4 as uuidv4 } from 'uuid';
import { Storage } from './storage';

export async function ensureDeviceId() {
  try {
    console.log('ensureDeviceId: Starting...');
    const deviceId = await Storage.getOrCreateDeviceId(() => uuidv4());
    console.log('ensureDeviceId: Completed with ID:', deviceId);
    return deviceId;
  } catch (error) {
    console.error('ensureDeviceId: Error:', error);
    // Fallback to a simple ID if UUID fails
    const fallbackId = `device_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    console.log('ensureDeviceId: Using fallback ID:', fallbackId);
    return fallbackId;
  }
}
