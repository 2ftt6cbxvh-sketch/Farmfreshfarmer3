import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import type { DeliveryResolution } from '../lib/types';

const STORAGE_KEY = 'deliveryResolution';

function isCoordinateInIndia(lat: number, lng: number): boolean {
  return lat >= 6.0 && lat <= 37.5 && lng >= 68.0 && lng <= 97.5;
}

export function useDelivery() {
  const [resolution, setResolution] = useState<DeliveryResolution | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const cached = await AsyncStorage.getItem(STORAGE_KEY);
        if (cached && mounted) {
          const parsed = JSON.parse(cached);
          if (parsed && typeof parsed === 'object') {
            setResolution(parsed);
            return;
          }
        }
      } catch {}

      // Auto-detect GPS if permission was already granted previously
      if (mounted) {
        autoDetectGps();
      }
    };
    init();
    return () => { mounted = false; };
  }, []);

  const saveResolution = useCallback(async (r: DeliveryResolution | null) => {
    setResolution(r);
    try {
      if (r) {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(r));
      } else {
        await AsyncStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  const autoDetectGps = async () => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return; // Do not nag on mount

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!isCoordinateInIndia(lat, lng)) return;

      const res = await api.post('/api/delivery/resolve', { lat, lng });
      if (res?.data) {
        await saveResolution({
          serviceable: res.data.serviceable,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          warehouseId: res.data.warehouseId,
          pincode: res.data.pincode || '',
          locationArea: res.data.locationArea || 'Your Location',
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
          distanceKm: res.data.distanceKm,
          maxRadiusKm: res.data.maxRadiusKm || 30,
          packingTimeMinutes: res.data.packingTimeMinutes,
          travelTimeMinutes: res.data.travelTimeMinutes,
          reason: res.data.reason,
        });
      }
    } catch {}
  };

  const resolveByGps = async () => {
    setIsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'GPS Permission Not Granted',
          etaMinutes: 0,
          fee: 0,
          maxRadiusKm: 30,
          reason: 'Please enter your 6-digit PIN code or allow location in device settings',
        });
        return;
      }

      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const lat = loc.coords.latitude;
      const lng = loc.coords.longitude;

      if (!isCoordinateInIndia(lat, lng)) {
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'Coordinates Outside India',
          etaMinutes: 0,
          fee: 0,
          maxRadiusKm: 30,
          reason: 'Please enter your 6-digit Indian PIN code to check local warehouse delivery',
        });
        return;
      }

      const res = await api.post('/api/delivery/resolve', { lat, lng }).catch(() => null);
      if (res?.data) {
        await saveResolution({
          serviceable: res.data.serviceable,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          warehouseId: res.data.warehouseId,
          pincode: res.data.pincode || '',
          locationArea: res.data.locationArea || 'Detected Location',
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
          distanceKm: res.data.distanceKm,
          maxRadiusKm: res.data.maxRadiusKm || 30,
          packingTimeMinutes: res.data.packingTimeMinutes,
          travelTimeMinutes: res.data.travelTimeMinutes,
          reason: res.data.reason,
        });
      } else {
        await saveResolution({
          serviceable: false,
          pincode: '',
          locationArea: 'Location Not Covered',
          etaMinutes: 0,
          fee: 0,
          maxRadiusKm: 30,
          reason: 'Currently outside our local warehouse serviceable radius',
        });
      }
    } catch (err: any) {
      await saveResolution({
        serviceable: false,
        pincode: '',
        locationArea: 'GPS Unavailable',
        etaMinutes: 0,
        fee: 0,
        maxRadiusKm: 30,
        reason: 'Could not acquire GPS. Please enter your 6-digit PIN code.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const resolveByPincode = async (pincode: string) => {
    if (!pincode || pincode.trim().length < 6) return;
    const cleanPin = pincode.trim();
    setIsLoading(true);

    try {
      const res = await api.post('/api/delivery/resolve', { pincode: cleanPin }).catch(() => null);
      if (res?.data) {
        await saveResolution({
          serviceable: res.data.serviceable,
          warehouseName: res.data.warehouseName || 'Farm Fresh Hub',
          warehouseId: res.data.warehouseId,
          pincode: cleanPin,
          locationArea: res.data.locationArea || `PIN ${cleanPin}`,
          etaMinutes: res.data.etaMinutes || 0,
          fee: res.data.fee || 0,
          distanceKm: res.data.distanceKm,
          maxRadiusKm: res.data.maxRadiusKm || 30,
          packingTimeMinutes: res.data.packingTimeMinutes,
          travelTimeMinutes: res.data.travelTimeMinutes,
          reason: res.data.reason,
        });
      } else {
        await saveResolution({
          serviceable: false,
          pincode: cleanPin,
          locationArea: `PIN ${cleanPin}`,
          etaMinutes: 0,
          fee: 0,
          maxRadiusKm: 30,
          reason: `PIN ${cleanPin} is not currently serviceable by any active warehouse`,
        });
      }
    } catch {
      await saveResolution({
        serviceable: false,
        pincode: cleanPin,
        locationArea: `PIN ${cleanPin}`,
        etaMinutes: 0,
        fee: 0,
        maxRadiusKm: 30,
        reason: 'Could not verify PIN code. Please check your internet connection.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearResolution = useCallback(async () => {
    await saveResolution(null);
  }, [saveResolution]);

  return {
    resolution,
    isLoading,
    resolveByGps,
    resolveByPincode,
    clearResolution,
  };
}
