import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import * as Location from 'expo-location';
import type { GeoLocation } from '@political-research/shared-types';

interface GeolocationCaptureProps {
    onCapture: (location: GeoLocation) => void;
}

export function GeolocationCapture({ onCapture }: GeolocationCaptureProps) {
    const [location, setLocation] = useState<GeoLocation | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                setError('Permissão de localização negada');
                return;
            }

            const currentLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.High,
            });

            const geo: GeoLocation = {
                latitude: currentLocation.coords.latitude,
                longitude: currentLocation.coords.longitude,
                accuracy: currentLocation.coords.accuracy ?? 0,
                timestamp: new Date(currentLocation.timestamp).toISOString(),
            };

            setLocation(geo);
            onCapture(geo);
        })();
    }, []);

    return (
        <View style={styles.container}>
            {error ? (
                <Text style={styles.errorText}>⚠ {error}</Text>
            ) : location ? (
                <View style={styles.locationInfo}>
                    <Text style={styles.label}>📍 Localização capturada</Text>
                    <Text style={styles.coords}>
                        {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                    </Text>
                    <Text style={styles.accuracy}>
                        Precisão: {location.accuracy.toFixed(0)}m
                    </Text>
                </View>
            ) : (
                <Text style={styles.loadingText}>Obtendo localização...</Text>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#f0f9ff',
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    locationInfo: {},
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0c4a6e',
        marginBottom: 4,
    },
    coords: {
        fontSize: 12,
        color: '#0369a1',
        fontFamily: 'monospace',
    },
    accuracy: {
        fontSize: 12,
        color: '#64748b',
        marginTop: 2,
    },
    errorText: {
        color: '#dc2626',
        fontSize: 14,
    },
    loadingText: {
        color: '#64748b',
        fontSize: 14,
    },
});
