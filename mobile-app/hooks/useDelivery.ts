import { useState, useEffect } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import type { DeliveryResolution, LockdownStatus } from '../lib/types';

export function useDelivery() {
  const [resolution, setResolution] = useState<DeliveryResolution | null>({
    pincode: '530003', locationArea: 'Visakhapatnam City', etaMinutes: 30, warehouseName: 'Farm Fresh Hub', packingTimeMinutes: 15, travelTimeMinutes: 15, serviceable: true
  });
  const [isLoading, setIsLoading] = useState(false);

  const resolveByGps = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;
      
      const geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      let locationArea = `GPS Location`;
      let pincode = '';
      if (geocode && geocode.length > 0) {
        const place = geocode[0];
        const cityStr = place.city || place.subregion || place.region;
        const districtStr = place.district;
        const parts = [cityStr, districtStr].filter(Boolean);
        if (parts.length > 0) {
          locationArea = parts.join(', ');
        }
        if (place.postalCode) {
          pincode = place.postalCode;
        }
      }

      const res = await api.post('/api/delivery/resolve', {
        lat,
        lng,
        pincode,
        locationArea
      }).catch(() => null);

      if (res?.data) {
        setResolution({ ...res.data, serviceable: true, warehouseName: res.data.warehouseName || 'Farm Fresh Hub' });
      } else {
        setResolution({
          pincode,
          locationArea,
          etaMinutes: 30,
          warehouseName: 'Farm Fresh Hub',
          packingTimeMinutes: 15,
          travelTimeMinutes: 15,
          serviceable: true
        });
      }
    } catch {
      // GPS failed
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
