// apps/mobile/src/services/compression/imageCompressor.ts
// Serviço de compressão agressiva de imagens para economizar storage

import * as ImageManipulator from 'expo-image-manipulator';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

export interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0.0 - 1.0
    format?: 'jpeg' | 'png';
    targetSizeKB?: number; // Tamanho alvo em KB
    removeExif?: boolean; // Remove metadados para privacidade
}

export interface CompressionResult {
    uri: string;
    width: number;
    height: number;
    size: number; // bytes
    originalSize: number;
    compressionRatio: number; // %
    mimeType: string;
}

export class ImageCompressor {
    // Configuração padrão agressiva para economizar 1GB do Supabase
    private static DEFAULT_OPTIONS: CompressionOptions = {
        maxWidth: 1920,
        maxHeight: 1080,
        quality: 0.7, // 70% quality
        format: 'jpeg',
        targetSizeKB: 200, // 200KB por imagem
        removeExif: true,
    };

    /**
     * Comprime uma imagem capturada
     */
    static async compressImage(
        imageUri: string,
        options: CompressionOptions = {}
    ): Promise<CompressionResult> {
        const opts = { ...this.DEFAULT_OPTIONS, ...options };

        try {
            // 1. Obtém informações originais
            const fileInfo = await FileSystem.getInfoAsync(imageUri);
            if (!fileInfo.exists) {
                throw new Error('Image file not found');
            }
            let originalSize = 0;
            if (fileInfo.exists && 'size' in fileInfo && typeof fileInfo.size === 'number') {
                originalSize = fileInfo.size;
            }

            // 2. Primeira compressão com resize
            let compressed = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    {
                        resize: {
                            width: opts.maxWidth,
                            height: opts.maxHeight,
                        },
                    },
                ],
                {
                    compress: opts.quality,
                    format: opts.format === 'png'
                        ? ImageManipulator.SaveFormat.PNG
                        : ImageManipulator.SaveFormat.JPEG,
                }
            );

            // 3. Verifica se atingiu o tamanho alvo
            let compressedInfo = await FileSystem.getInfoAsync(compressed.uri);
            let currentSize = 0;
            if (compressedInfo.exists && 'size' in compressedInfo && typeof compressedInfo.size === 'number') {
                currentSize = compressedInfo.size;
            }
            let currentQuality = opts.quality!;

            // 4. Compressão iterativa até atingir targetSizeKB
            if (opts.targetSizeKB && currentSize > opts.targetSizeKB * 1024) {
                let attempts = 0;
                const maxAttempts = 5;

                while (
                    currentSize > opts.targetSizeKB * 1024 &&
                    attempts < maxAttempts &&
                    currentQuality > 0.3
                ) {
                    currentQuality -= 0.1; // Reduz qualidade em 10%

                    compressed = await ImageManipulator.manipulateAsync(
                        compressed.uri,
                        [], // Sem resize adicional
                        {
                            compress: currentQuality,
                            format: ImageManipulator.SaveFormat.JPEG,
                        }
                    );

                    compressedInfo = await FileSystem.getInfoAsync(compressed.uri);
                    if (compressedInfo.exists && 'size' in compressedInfo && typeof compressedInfo.size === 'number') {
                        currentSize = compressedInfo.size;
                    } else {
                        currentSize = 0;
                    }
                    attempts++;
                }

                console.log(
                    `Compression took ${attempts} attempts, final quality: ${currentQuality.toFixed(2)}`
                );
            }

            // 5. Remove EXIF se solicitado (privacidade)
            if (opts.removeExif) {
                // EXIF é automaticamente removido pelo ImageManipulator
                console.log('✅ EXIF data removed');
            }

            const compressionRatio =
                ((originalSize - currentSize) / originalSize) * 100;

            const result: CompressionResult = {
                uri: compressed.uri,
                width: compressed.width,
                height: compressed.height,
                size: currentSize,
                originalSize,
                compressionRatio,
                mimeType: opts.format === 'png' ? 'image/png' : 'image/jpeg',
            };

            console.log(`\n        📊 Compression Summary:\n        Original: ${(originalSize / 1024).toFixed(2)} KB\n        Compressed: ${(currentSize / 1024).toFixed(2)} KB\n        Ratio: ${compressionRatio.toFixed(2)}%\n        Dimensions: ${result.width}x${result.height}\n      `);

            return result;
        } catch (error) {
            console.error('Image compression failed:', error);
            throw error;
        }
    }

    /**
     * Captura foto da câmera com compressão automática
     */
    static async capturePhoto(
        options: CompressionOptions = {}
    ): Promise<CompressionResult | null> {
        try {
            // Solicita permissão da câmera
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Camera permission denied');
            }

            // Captura foto
            const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8, // Pré-compressão no picker
            });

            if (result.canceled) {
                return null;
            }

            const photoUri = result.assets[0].uri;

            // Comprime a foto capturada
            return await this.compressImage(photoUri, options);
        } catch (error) {
            console.error('Photo capture failed:', error);
            throw error;
        }
    }

    /**
     * Seleciona foto da galeria com compressão automática
     */
    static async pickFromGallery(
        options: CompressionOptions = {}
    ): Promise<CompressionResult | null> {
        try {
            // Solicita permissão da galeria
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                throw new Error('Gallery permission denied');
            }

            // Seleciona foto
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [4, 3],
                quality: 0.8,
            });

            if (result.canceled) {
                return null;
            }

            const photoUri = result.assets[0].uri;

            // Comprime a foto selecionada
            return await this.compressImage(photoUri, options);
        } catch (error) {
            console.error('Photo selection failed:', error);
            throw error;
        }
    }

    /**
     * Batch compression (múltiplas imagens)
     */
    static async compressBatch(
        imageUris: string[],
        options: CompressionOptions = {}
    ): Promise<CompressionResult[]> {
        const results: CompressionResult[] = [];

        for (const uri of imageUris) {
            try {
                const compressed = await this.compressImage(uri, options);
                results.push(compressed);
            } catch (error) {
                console.error(`Failed to compress ${uri}:`, error);
                // Continua com as próximas imagens
            }
        }

        return results;
    }

    /**
     * Estima quantas imagens cabem no storage disponível
     */
    static async estimateCapacity(
        availableSpaceMB: number,
        avgImageSizeKB: number = 200
    ): Promise<number> {
        const availableKB = availableSpaceMB * 1024;
        return Math.floor(availableKB / avgImageSizeKB);
    }

    /**
     * Gera thumbnail (preview pequeno)
     */
    static async generateThumbnail(
        imageUri: string,
        size: number = 150
    ): Promise<CompressionResult> {
        return await this.compressImage(imageUri, {
            maxWidth: size,
            maxHeight: size,
            quality: 0.6,
            format: 'jpeg',
        });
    }

    /**
     * Adiciona watermark (marca d'água) para segurança
     */
    static async addWatermark(
        imageUri: string,
        watermarkText: string
    ): Promise<string> {
        try {
            // Cria canvas com texto
            const result = await ImageManipulator.manipulateAsync(
                imageUri,
                [
                    {
                        resize: { width: 1920 }, // Mantém proporção
                    },
                ],
                {
                    compress: 0.8,
                    format: ImageManipulator.SaveFormat.JPEG,
                }
            );

            // Nota: Para watermark real, você precisaria usar react-native-canvas
            // ou processar no backend. Esta é uma versão simplificada.

            console.log(`✅ Watermark simulated for: ${watermarkText}`);
            return result.uri;
        } catch (error) {
            console.error('Watermark failed:', error);
            throw error;
        }
    }

    /**
     * Valida se a imagem está legível (não corrompida)
     */
    static async validateImage(imageUri: string): Promise<boolean> {
        try {
            const info = await FileSystem.getInfoAsync(imageUri);
            if (!info.exists) return false;

            // Tenta manipular para validar integridade
            await ImageManipulator.manipulateAsync(
                imageUri,
                [{ resize: { width: 100 } }],
                { compress: 1 }
            );

            return true;
        } catch (error) {
            console.error('Image validation failed:', error);
            return false;
        }
    }

    /**
     * Limpa cache de imagens temporárias
     */
    static async clearCache(): Promise<void> {
        try {
            const cacheDir = `${FileSystem.cacheDirectory}ImageManipulator/`;
            const files = await FileSystem.readDirectoryAsync(cacheDir);

            for (const file of files) {
                await FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true });
            }

            console.log(`✅ Cleared ${files.length} cached images`);
        } catch (error) {
            console.error('Cache clearing failed:', error);
        }
    }
}

// ========================================================================
// EXEMPLO DE USO COMPLETO:
// ========================================================================
/*
import { ImageCompressor } from './services/compression/imageCompressor';

// 1. Capturar foto com compressão
async function handleCapturePhoto() {
    try {
        const result = await ImageCompressor.capturePhoto({
            maxWidth: 1920,
            maxHeight: 1080,
            quality: 0.7,
            targetSizeKB: 200,
        });

        if (result) {
            console.log('Photo captured and compressed:', result);
            console.log(`Saved ${result.compressionRatio.toFixed(2)}% of space!`);
      
            // Salvar no SQLite
            await savePhotoToDatabase(result.uri);
      
            // Adicionar à fila de upload
            await addToSyncQueue('media', result.uri);
        }
    } catch (error) {
        console.error('Failed to capture photo:', error);
    }
}

// 2. Batch compression de fotos antigas
async function compressExistingPhotos() {
    const photos = await getUncompressedPhotos();
    const compressed = await ImageCompressor.compressBatch(photos);
  
    console.log(`Compressed ${compressed.length} photos`);
  
    const totalSaved = compressed.reduce(
        (acc, photo) => acc + (photo.originalSize - photo.size),
        0
    );
  
    console.log(`Total space saved: ${(totalSaved / 1024 / 1024).toFixed(2)} MB`);
}

// 3. Estimar capacidade
async function checkStorageCapacity() {
    const capacity = await ImageCompressor.estimateCapacity(
        1024, // 1GB disponível
        200   // 200KB por foto média
    );
  
    console.log(`You can store approximately ${capacity} photos`);
}
*/
