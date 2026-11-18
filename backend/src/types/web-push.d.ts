// Fallback ambient declaration for web-push in environments where @types/web-push is omitted
declare module 'web-push' {
  export interface PushSubscriptionKeys {
    p256dh: string;
    auth: string;
  }

  export interface PushSubscription {
    endpoint: string;
    keys: PushSubscriptionKeys;
  }

  export interface RequestOptions {
    headers?: Record<string, any>;
    gcmAPIKey?: string;
    vapidDetails?: {
      subject: string;
      publicKey: string;
      privateKey: string;
    };
    TTL?: number;
    urgency?: 'very-low' | 'low' | 'normal' | 'high';
    topic?: string;
    contentEncoding?: string;
    proxy?: string;
  }

  export interface SendResult {
    statusCode: number;
    body: string;
    headers: Record<string, any>;
  }

  export interface VapidKeys {
    publicKey: string;
    privateKey: string;
  }

  export function setVapidDetails(subject: string, publicKey: string, privateKey: string): void;
  export function generateVAPIDKeys(): VapidKeys;
  export function sendNotification(
    subscription: PushSubscription,
    payload?: string | Buffer | null,
    options?: RequestOptions
  ): Promise<SendResult>;

  const webpush: {
    setVapidDetails: typeof setVapidDetails;
    generateVAPIDKeys: typeof generateVAPIDKeys;
    sendNotification: typeof sendNotification;
  };

  export default webpush;
}
