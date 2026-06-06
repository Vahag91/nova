import { useEffect } from 'react';
import { AppState } from 'react-native';

import { ensureDeviceId } from '../lib/deviceId';
import { createSbWithDevice, fetchBalanceByDevice } from '../lib/supabaseDevice';
import { useImagesStore } from '../state/useImagesStore';

export default function useCoinBalance() {
  const coins = useImagesStore(state => state.coinsBalance);
  const setCoinsBalance = useImagesStore(state => state.setCoinsBalance);

  useEffect(() => {
    let mounted = true;

    const loadBalance = async (force = false) => {
      if (!force) {
        const currentBalance = useImagesStore.getState().coinsBalance;
        if (typeof currentBalance === 'number') {
          return;
        }
      }

      try {
        const deviceId = await ensureDeviceId();
        const sb = createSbWithDevice(deviceId);
        const balance = await fetchBalanceByDevice(sb, deviceId);
        if (mounted) {
          setCoinsBalance(balance);
        }
      } catch {
        if (mounted) {
          setCoinsBalance(null);
        }
      }
    };

    loadBalance();

    const appStateSubscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        loadBalance(true);
      }
    });

    return () => {
      mounted = false;
      appStateSubscription.remove();
    };
  }, [setCoinsBalance]);

  return coins;
}
