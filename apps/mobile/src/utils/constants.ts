// App Constants

export const APP_NAME = 'SPI - Sistema de Pesquisa Inteligente';

export const SYNC = {
    MAX_RETRIES: 5,
    BASE_DELAY_MS: 1000,
    MAX_DELAY_MS: 30000,
    BATCH_SIZE: 50,
} as const;

export const MEDIA = {
    IMAGE_MAX_WIDTH: 1280,
    IMAGE_MAX_HEIGHT: 960,
    IMAGE_QUALITY: 0.7,
    AUDIO_BITRATE: 64000,
} as const;

export const GEOLOCATION = {
    HIGH_ACCURACY: true,
    TRACKING_INTERVAL_MS: 5000,
    DISTANCE_INTERVAL_M: 10,
} as const;

export const STORAGE_KEYS = {
    AUTH_TOKEN: 'auth_token',
    USER_PROFILE: 'user_profile',
    LAST_SYNC: 'last_sync',
    DB_VERSION: 'db_version',
} as const;
