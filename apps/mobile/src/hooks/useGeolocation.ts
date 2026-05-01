// apps/mobile/src/hooks/useGeolocation.ts
// Hook para captura de localização com reverse geocoding

import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

const LOCATION_TASK_NAME = 'background-location-task';

export interface GeolocationData {
    latitude: number;
    longitude: number;
    accuracy: number;
    altitude: number | null;
    heading: number | null;
    speed: number | null;
    timestamp: number;
}

export interface AddressData {
    street?: string;
    city?: string;
    region?: string; // Estado
    country?: string;
    postalCode?: string;
    formattedAddress?: string;
}

export interface LocationState {
    location: GeolocationData | null;
    address: AddressData | null;
    isLoading: boolean;
    error: string | null;
    permissionStatus: Location.PermissionStatus | null;
}

interface UseGeolocationOptions {
    enableHighAccuracy?: boolean;
    timeout?: number;
    maximumAge?: number;
    distanceInterval?: number;
    enableBackgroundUpdates?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
    const {
        enableHighAccuracy = true,
        timeout = 15000,
        maximumAge = 10000,
        distanceInterval = 10, // meters
        enableBackgroundUpdates = false,
    } = options;

    const [state, setState] = useState<LocationState>({
        location: null,
        address: null,
        isLoading: false,
        error: null,
        permissionStatus: null,
    });

    // ========================================================================
    // Solicita permissão de localização
    // ========================================================================
    const requestPermission = useCallback(async () => {
        try {
            const { status: foregroundStatus } =
                await Location.requestForegroundPermissionsAsync();

            if (foregroundStatus !== 'granted') {
                setState(prev => ({
                    ...prev,
                    error: 'Permissão de localização negada',
                    permissionStatus: foregroundStatus,
                }));
                return false;
            }

            // Se background updates habilitado, solicita permissão adicional
            if (enableBackgroundUpdates) {
                const { status: backgroundStatus } =
                    await Location.requestBackgroundPermissionsAsync();

                if (backgroundStatus !== 'granted') {
                    console.warn('Background location permission denied');
                }
            }

            setState(prev => ({
                ...prev,
                permissionStatus: foregroundStatus,
                error: null,
            }));

            return true;
        } catch (error) {
            console.error('Permission request failed:', error);
            setState(prev => ({
                ...prev,
                error: 'Erro ao solicitar permissão',
            }));
            return false;
        }
    }, [enableBackgroundUpdates]);

    // ========================================================================
    // Captura localização atual
    // ========================================================================
    const getCurrentLocation = useCallback(async (): Promise<GeolocationData | null> => {
        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const hasPermission = await requestPermission();
            if (!hasPermission) return null;

            const location = await Location.getCurrentPositionAsync({
                accuracy: enableHighAccuracy
                    ? Location.Accuracy.BestForNavigation
                    : Location.Accuracy.Balanced,
                timeInterval: maximumAge,
            });

            const geoData: GeolocationData = {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                accuracy: location.coords.accuracy || 0,
                altitude: location.coords.altitude,
                heading: location.coords.heading,
                speed: location.coords.speed,
                timestamp: location.timestamp,
            };

            setState(prev => ({
                ...prev,
                location: geoData,
                isLoading: false,
                error: null,
            }));

            return geoData;
        } catch (error: any) {
            console.error('Failed to get location:', error);

            let errorMessage = 'Erro ao obter localização';
            if (error.code === 'E_LOCATION_UNAVAILABLE') {
                errorMessage = 'Localização indisponível. Verifique se o GPS está ativado.';
            } else if (error.code === 'E_LOCATION_TIMEOUT') {
                errorMessage = 'Tempo esgotado ao buscar localização.';
            }

            setState(prev => ({
                ...prev,
                isLoading: false,
                error: errorMessage,
            }));

            return null;
        }
    }, [enableHighAccuracy, maximumAge, requestPermission]);

    // ========================================================================
    // Reverse Geocoding (coordenadas → endereço)
    // ========================================================================
    const getAddress = useCallback(async (
        latitude: number,
        longitude: number
    ): Promise<AddressData | null> => {
        try {
            const addresses = await Location.reverseGeocodeAsync({
                latitude,
                longitude,
            });

            if (addresses.length === 0) {
                return null;
            }

            const addr = addresses[0];
            const addressData: AddressData = {
                street: addr.street || undefined,
                city: addr.city || addr.subregion || undefined,
                region: addr.region || undefined,
                country: addr.country || undefined,
                postalCode: addr.postalCode || undefined,
                formattedAddress: formatAddress(addr),
            };

            setState(prev => ({
                ...prev,
                address: addressData,
            }));

            return addressData;
        } catch (error) {
            console.error('Reverse geocoding failed:', error);
            return null;
        }
    }, []);

    // ========================================================================
    // Captura localização com endereço
    // ========================================================================
    const getLocationWithAddress = useCallback(async () => {
        const location = await getCurrentLocation();
        if (!location) return null;

        const address = await getAddress(location.latitude, location.longitude);

        return { location, address };
    }, [getCurrentLocation, getAddress]);

    // ========================================================================
    // Watch position (atualização contínua)
    // ========================================================================
    const startWatching = useCallback(async (
        callback: (data: { location: GeolocationData; address: AddressData | null }) => void
    ) => {
        const hasPermission = await requestPermission();
        if (!hasPermission) return null;

        const subscription = await Location.watchPositionAsync(
            {
                accuracy: enableHighAccuracy
                    ? Location.Accuracy.BestForNavigation
                    : Location.Accuracy.Balanced,
                timeInterval: 5000, // Atualiza a cada 5 segundos
                distanceInterval,
            },
            async (location) => {
                const geoData: GeolocationData = {
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy || 0,
                    altitude: location.coords.altitude,
                    heading: location.coords.heading,
                    speed: location.coords.speed,
                    timestamp: location.timestamp,
                };

                setState(prev => ({ ...prev, location: geoData }));

                // Reverse geocoding (opcional, pode ser custoso)
                const address = await getAddress(geoData.latitude, geoData.longitude);

                callback({ location: geoData, address });
            }
        );

        return subscription;
    }, [enableHighAccuracy, distanceInterval, requestPermission, getAddress]);

    // ========================================================================
    // Background location tracking (para pesquisas longas)
    // ========================================================================
    const startBackgroundTracking = useCallback(async () => {
        const hasPermission = await requestPermission();
        if (!hasPermission) return;

        // Define a task antes de iniciar
        TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
            if (error) {
                console.error('Background location error:', error);
                return;
            }
            if (data) {
                const { locations } = data as any;
                console.log('Background location update:', locations);
                // Aqui você pode salvar no SQLite para análise posterior
            }
        });

        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 30000, // A cada 30 segundos
            distanceInterval: 50, // Ou a cada 50 metros
            foregroundService: {
                notificationTitle: 'Pesquisa em andamento',
                notificationBody: 'Rastreando sua localização',
                notificationColor: '#3b82f6',
            },
        });

        console.log('✅ Background location tracking started');
    }, [requestPermission]);

    const stopBackgroundTracking = useCallback(async () => {
        const isTracking = await Location.hasStartedLocationUpdatesAsync(
            LOCATION_TASK_NAME
        );

        if (isTracking) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
            console.log('✅ Background location tracking stopped');
        }
    }, []);

    // ========================================================================
    // Calcula distância entre dois pontos (Haversine)
    // ========================================================================
    const calculateDistance = useCallback((
        lat1: number,
        lon1: number,
        lat2: number,
        lon2: number
    ): number => {
        const R = 6371e3; // Raio da Terra em metros
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distância em metros
    }, []);

    // ========================================================================
    // Auto-request permission on mount
    // ========================================================================
    useEffect(() => {
        requestPermission();
    }, [requestPermission]);

    return {
        ...state,
        getCurrentLocation,
        getAddress,
        getLocationWithAddress,
        startWatching,
        startBackgroundTracking,
        stopBackgroundTracking,
        calculateDistance,
        requestPermission,
    };
}

// ========================================================================
// Helper: Formata endereço completo
// ========================================================================
function formatAddress(addr: Location.LocationGeocodedAddress): string {
    const parts: string[] = [];

    if (addr.street) parts.push(addr.street);
    if (addr.streetNumber) parts.push(addr.streetNumber);
    if (addr.city || addr.subregion) parts.push(addr.city || addr.subregion!);
    if (addr.region) parts.push(addr.region);
    if (addr.postalCode) parts.push(addr.postalCode);
    if (addr.country) parts.push(addr.country);

    return parts.join(', ');
}

// ========================================================================
// EXEMPLO DE USO:
// ========================================================================
/*
function SurveyScreen() {
  const { 
    location, 
    address, 
    isLoading, 
    error, 
    getLocationWithAddress 
  } = useGeolocation({ 
    enableHighAccuracy: true,
    enableBackgroundUpdates: true 
  });

  const handleCaptureLocation = async () => {
    const result = await getLocationWithAddress();
    if (result) {
      console.log('Location:', result.location);
      console.log('Address:', result.address);
    }
  };

  return (
    <View>
      <Button onPress={handleCaptureLocation} title="Capturar Localização" />
      {isLoading && <Text>Obtendo localização...</Text>}
      {error && <Text style={{ color: 'red' }}>{error}</Text>}
      {location && (
        <Text>
          {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          {'\n'}Precisão: {location.accuracy.toFixed(1)}m
        </Text>
      )}
      {address && <Text>{address.formattedAddress}</Text>}
    </View>
  );
}
*/
