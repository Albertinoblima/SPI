import { NextRequest, NextResponse } from 'next/server';
import { getSafeRedirectPath } from '@/lib/auth/login';
import { createRouteHandlerClient } from '@/lib/supabase/route';

export async function GET(request: NextRequest) {
    const requestUrl = new URL(request.url);
    const code = requestUrl.searchParams.get('code');
    const fallbackPath = '/dashboard';
    const nextPath = getSafeRedirectPath(requestUrl.searchParams.get('next'), fallbackPath);
    const { supabase, applyCookies } = createRouteHandlerClient();

    if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (!error) {
            return applyCookies(NextResponse.redirect(new URL(nextPath, request.url)));
        }
    }

    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'oauth_callback_failed');

    return applyCookies(NextResponse.redirect(loginUrl));
}