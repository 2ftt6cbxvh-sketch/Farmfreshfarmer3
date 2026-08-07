import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import type { DeliveryResolution, LockdownStatus } from '../lib/types';

const STORAGE_KEY = 'deliveryResolution';

// India geographic bounding box
function isCoordinateInIndia(lat: number, lng: number): boolean {
  return lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5;
}

export function useDelivery() {
  const [resolution, setResolution] = useState<DeliveryResolution | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // On mount: load cached resolution, then auto-detect GPS (same as web)
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      // 1. Load any cached resolution from previous session
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached && mounted) {
          setResolution(JSON.parse(cached));
          return; // Use cache, don't auto-GPS if already resolved
        }
      } catch {}

      // 2. No cache -> auto-detect GPS exactly like the web version does
      if (mounted) {
        autoDetectGps();
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  // Save resolution to AsyncStorage whenever it changes
  const saveResolution = useCallback(async (r: DeliveryResolution | null) => {
    setResolution(r);
    if (r) {
      try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(r)); } catch {}
    } else {
      try { await AsyncStorage.removeItem(STORAGE_KEY); } catch {}
    }
  }, []);

  // Silent GPS auto-detect on mount (user never sees a modal for this)
  const autoDetectGps = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return; // Silently skip

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!isCoordinateInIndia(lat, lng)) {
        // GPS returned non-India coordinates (iOS Simulator fake location)
        // Silently skip - user will enter pincode manually
        console.log('[GPS] Non-India coordinates detected, skipping auto-detect:', lat, lng);
        return;
      }

      const res = await api.post('/api/delivery/resolve', { lat, lng });
      if (res?.data) {
        await saveResolution({
          ...res.data,
          serviceable: res.data.serviceable,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          pincode: res.data.pincode || '',
          locationArea: res.data.locationArea || 'Unknown Area',
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
        });
      }
    } catch {
      // Silent fail on auto-detect
    }
  };

  // User-initiated GPS (tapped the GPS button) - shows loading state
  const resolveByGps = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'GPS Permission Denied',
          etaMinutes: 0,
          fee: 0,
          reason: 'Please allow location access in Settings',
        });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!isCoordinateInIndia(lat, lng)) {
        // GPS returned non-India coordinates (iOS Simulator fake location)
        // Set a non-serviceable resolution asking user to enter pincode
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'GPS location unavailable',
          etaMinutes: 0,
          fee: 0,
          reason: 'Please enter your 6-digit Indian PIN code manually',
        });
        setIsLoading(false);
        return;
      }

      const res = await api.post('/api/delivery/resolve', { lat, lng }).catch(() => null);

      if (res?.data) {
        await saveResolution({
          ...res.data,
          serviceable: res.data.serviceable,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          pincode: res.data.pincode || '',
          locationArea: res.data.locationArea || 'Unknown Area',
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
        });
      } else {
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'Location Not Covered Yet',
          etaMinutes: 0,
          fee: 0,
          reason: 'Not serviceable in your area',
        });
      }
    } catch {
      await saveResolution({
        serviceable: false,
        pincode: '',
        locationArea: 'Error detecting location',
        etaMinutes: 0,
        fee: 0,
        reason: 'Could not detect GPS. Please enter PIN code manually.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Pincode-based resolution - shows error feedback on failure
  const resolveByPincode = async (pincode: string) => {
    if (!pincode || pincode.trim().length < 4) return;
    setIsLoading(true);
    try {
      const res = await api.post('/api/delivery/resolve', { pincode: pincode.trim() });
      if (res?.data) {
        await saveResolution({
          ...res.data,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          pincode: res.data.pincode || pincode.trim(),
          locationArea: res.data.locationArea || `PIN ${pincode.trim()}`,
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
        });
      }
    } catch {
      await saveResolution({
        serviceable: false,
        pincode: pincode.trim(),
        locationArea: `PIN ${pincode.trim()}`,
        etaMinutes: 0,
        fee: 0,
        reason: 'Could not check serviceability. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Clear saved resolution
  const clearResolution = useCallback(async () => {
    await saveResolution(null);
  }, [saveResolution]);

  return { resolution, isLoading, resolveByGps, resolveByPincode, clearResolution };
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
