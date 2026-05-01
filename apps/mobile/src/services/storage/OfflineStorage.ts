// Offline Storage Service (SQLite + AsyncStorage)
import * as FileSystem from 'expo-file-system';

export class OfflineStorage {
    private cacheDir: string;

    constructor() {
        this.cacheDir = `${FileSystem.cacheDirectory}offline/`;
    }

    async init(): Promise<void> {
        const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
        if (!dirInfo.exists) {
            await FileSystem.makeDirectoryAsync(this.cacheDir, { intermediates: true });
        }
    }

    async saveFile(key: string, data: string): Promise<string> {
        const path = `${this.cacheDir}${key}`;
        await FileSystem.writeAsStringAsync(path, data);
        return path;
    }

    async readFile(key: string): Promise<string | null> {
        const path = `${this.cacheDir}${key}`;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        return FileSystem.readAsStringAsync(path);
    }

    async deleteFile(key: string): Promise<void> {
        const path = `${this.cacheDir}${key}`;
        const info = await FileSystem.getInfoAsync(path);
        if (info.exists) {
            await FileSystem.deleteAsync(path);
        }
    }

    async getCacheSize(): Promise<number> {
        const dirInfo = await FileSystem.getInfoAsync(this.cacheDir);
        return dirInfo.exists && 'size' in dirInfo ? (dirInfo.size ?? 0) : 0;
    }

    async clearCache(): Promise<void> {
        await FileSystem.deleteAsync(this.cacheDir, { idempotent: true });
        await this.init();
    }
}
