// Supabase Webhook Handler
import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';

function isValidWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
    const secret = process.env['SUPABASE_WEBHOOK_SECRET'];
    if (!secret || !signatureHeader) {
        return false;
    }

    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    const provided = signatureHeader.replace(/^sha256=/i, '').trim();

    const expectedBuffer = Buffer.from(expected);
    const providedBuffer = Buffer.from(provided);
    if (expectedBuffer.length !== providedBuffer.length) {
        return false;
    }

    return timingSafeEqual(expectedBuffer, providedBuffer);
}

export async function POST(request: NextRequest) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get('x-webhook-signature') || request.headers.get('x-supabase-signature');
        if (!isValidWebhookSignature(rawBody, signature)) {
            return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
        }

        const payload = JSON.parse(rawBody) as Record<string, unknown>;
        const eventType = request.headers.get('x-supabase-event');

        switch (eventType) {
            case 'INSERT':
                // Handle new records
                break;
            case 'UPDATE':
                // Handle updated records
                break;
            case 'DELETE':
                // Handle deleted records
                break;
            default:
                break;
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        return NextResponse.json(
            { error: 'Webhook processing failed' },
            { status: 500 }
        );
    }
}
