// Background Location Tracker
import * as Location from 'expo-location';
import type { GeoLocation } from '@political-research/shared-types';

export class LocationTracker {
    private watchId: Location.LocationSubscription | null = null;

    async startTracking(
        onUpdate: (location: GeoLocation) => void,
        intervalMs = 5000
    ): Promise<void> {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permissão de localização negada');
        }

        this.watchId = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.High,
                timeInterval: intervalMs,
                distanceInterval: 10,
            },
            (location) => {
                onUpdate({
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy ?? 0,
                    timestamp: new Date(location.timestamp).toISOString(),
                });
            }
        );
    }

    stopTracking(): void {
        if (this.watchId) {
            this.watchId.remove();
            this.watchId = null;
        }
    }

    async getCurrentLocation(): Promise<GeoLocation> {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
            throw new Error('Permissão de localização negada');
        }

        const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
        });

        return {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            accuracy: location.coords.accuracy ?? 0,
            timestamp: new Date(location.timestamp).toISOString(),
        };
    }
}
