import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import type { DeliveryResolution, LockdownStatus } from '../lib/types';

export function useDelivery() {
  const [resolution, setResolution] = useState<DeliveryResolution | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const resolveByGps = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'GPS Denied',
          etaMinutes: 0,
          fee: 0,
          reason: 'Permission Denied'
        });
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      
      const res = await api.post('/api/delivery/resolve', {
        lat,
        lng
      }).catch(() => null);

      if (res?.data) {
        setResolution({ 
          ...res.data, 
          serviceable: res.data.serviceable, 
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          pincode: res.data.pincode || '',
          locationArea: res.data.locationArea || 'Unknown Area',
          etaMinutes: res.data.etaMinutes || 0
        });
      } else {
        setResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'Unknown',
          etaMinutes: 0,
          fee: 0,
          reason: 'Not Serviceable'
        });
      }
    } catch {
      setResolution({
        serviceable: false,
        pincode: '',
        locationArea: 'Error',
        etaMinutes: 0,
        fee: 0,
        reason: 'Error detecting location'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resolveByPincode = async (pincode: string) => {
    setIsLoading(true);
    try {
      const res = await api.post('/api/delivery/resolve', { pincode });
      setResolution({ ...res.data, warehouseName: res.data.warehouseName || 'Farm Fresh Hub' });
    } catch {
      // Pincode failed
    } finally {
      setIsLoading(false);
    }
  };

  return { resolution, isLoading, resolveByGps, resolveByPincode };
}

export function useLockdown() {
  const [lockdown, setLockdown] = useState<LockdownStatus>({ active: false, reason: '' });

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.get('/api/delivery/status');
        if (res.data?.lockdown) setLockdown(res.data.lockdown);
      } catch {
        // ignore
      }
    };
    check();
    const interval = setInterval(check, 30000);
    return () => clearInterval(interval);
  }, []);

  return lockdown;
}
