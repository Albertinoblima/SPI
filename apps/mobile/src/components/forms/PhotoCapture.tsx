import React, { useState } from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';

interface PhotoCaptureProps {
    onCapture: (uri: string) => void;
}

export function PhotoCapture({ onCapture }: PhotoCaptureProps) {
    const [photoUri, setPhotoUri] = useState<string | null>(null);

    const handleCapture = async () => {
        // TODO: Implement camera capture with expo-camera
        // For now, placeholder
    };

    return (
        <View style={styles.container}>
            {photoUri ? (
                <View>
                    <Image source={{ uri: photoUri }} style={styles.preview} />
                    <TouchableOpacity style={styles.retakeButton} onPress={handleCapture}>
                        <Text style={styles.retakeText}>Tirar Novamente</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
                    <Text style={styles.captureText}>📷 Capturar Foto</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    preview: {
        width: '100%',
        height: 200,
        borderRadius: 8,
        marginBottom: 8,
    },
    captureButton: {
        backgroundColor: '#e2e8f0',
        borderRadius: 8,
        padding: 24,
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#cbd5e1',
        borderStyle: 'dashed',
    },
    captureText: {
        fontSize: 16,
        color: '#475569',
    },
    retakeButton: {
        alignItems: 'center',
        padding: 8,
    },
    retakeText: {
        color: '#2563eb',
        fontSize: 14,
    },
});
