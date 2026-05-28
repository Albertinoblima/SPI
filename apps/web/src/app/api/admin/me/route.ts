// GET /api/admin/me - Verifica se o usuário atual é system_admin (usado para proteção client-side)
import { NextRequest } from 'next/server';
import {
    requireSystemAdmin,
    apiError,
    apiSuccess,
} from '@/lib/api-middleware';

export async function GET(request: NextRequest) {
    const auth = await requireSystemAdmin(request);

    if (!auth.isAuthorized) {
        return apiError(auth.error ?? 'Acesso negado', auth.status ?? 403);
    }

    return apiSuccess({
        is_system_admin: true,
        user: {
            id: auth.user.id,
            email: auth.user.email,
        },
    });
}
