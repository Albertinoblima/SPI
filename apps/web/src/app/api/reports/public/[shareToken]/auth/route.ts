import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/api-middleware';
import { publicReportAccessService } from '@/lib/reports/PublicReportAccessService';

export async function POST(
  request: NextRequest,
  { params }: { params: { shareToken: string } }
) {
  try {
    const { email, password } = await request.json();

    const result = await publicReportAccessService.validateAccess(
      params.shareToken,
      email,
      password
    );

    if (!result.valid) {
      return apiError(result.reason || 'Acesso negado', 401);
    }

    // Em produção, aqui poderíamos gerar um JWT de sessão para o contratante
    return apiSuccess({ 
      message: 'Autenticado com sucesso',
      share: result.share 
    });
  } catch (error) {
    return apiError('Erro ao autenticar', 500);
  }
}