// Exponential Backoff Retry Strategy

export class RetryStrategy {
    private maxRetries: number;
    private baseDelay: number;

    constructor(maxRetries = 5, baseDelay = 1000) {
        this.maxRetries = maxRetries;
        this.baseDelay = baseDelay;
    }

    shouldRetry(currentRetryCount: number): boolean {
        return currentRetryCount < this.maxRetries;
    }

    getDelay(retryCount: number): number {
        // Exponential backoff with jitter
        const exponentialDelay = this.baseDelay * Math.pow(2, retryCount);
        const jitter = Math.random() * this.baseDelay;
        return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
    }

    async wait(retryCount: number): Promise<void> {
        const delay = this.getDelay(retryCount);
        return new Promise((resolve) => setTimeout(resolve, delay));
    }
}
