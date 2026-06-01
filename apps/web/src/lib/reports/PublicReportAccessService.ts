/**
 * PublicReportAccessService
 * 
 * Gerencia acesso protegido aos relatórios dinâmicos por parte dos contratantes.
 * 
 * Decisão de alinhamento com schema real (migration 20260528000001):
 * - Credenciais do contratante ficam diretamente em report_shares (contractor_email + password_hash)
 * - Suporte a 1 contratante principal por share (simples e suficiente para v1)
 * - Mantém modelo híbrido: token + credenciais para protected
 */

import { createAuditedSupabaseAdminClient } from '@political-research/shared-utils';
import bcrypt from 'bcryptjs';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const PUBLIC_REPORT_SESSION_TTL_SECONDS = 15 * 60;
const SESSION_AUDIENCE = 'public-report-access';

export const PUBLIC_REPORT_SESSION_COOKIE = 'pr_access';

interface PublicAccessSessionPayload {
  aud: string;
  shareToken: string;
  iat: number;
  exp: number;
  nonce: string;
}

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

export class PublicReportAccessService {
  private supabase = createAuditedSupabaseAdminClient('PublicReportAccessService');

  private getSessionSecret(): string {
    return process.env['PUBLIC_REPORT_SESSION_SECRET'] || process.env['SUPABASE_SERVICE_ROLE_KEY'] || '';
  }

  private signSessionPayload(payloadSegment: string): string {
    const secret = this.getSessionSecret();
    if (!secret) {
      throw new Error('PUBLIC_REPORT_SESSION_SECRET não configurado');
    }

    return createHmac('sha256', secret)
      .update(payloadSegment)
      .digest('base64url');
  }

  private verifySessionSignature(payloadSegment: string, providedSignature: string): boolean {
    const expectedSignature = this.signSessionPayload(payloadSegment);
    const provided = Buffer.from(providedSignature);
    const expected = Buffer.from(expectedSignature);

    if (provided.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(provided, expected);
  }

  createPublicSessionToken(shareToken: string, ttlSeconds: number = PUBLIC_REPORT_SESSION_TTL_SECONDS): string {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const payload: PublicAccessSessionPayload = {
      aud: SESSION_AUDIENCE,
      shareToken,
      iat: nowSeconds,
      exp: nowSeconds + ttlSeconds,
      nonce: randomBytes(8).toString('hex'),
    };

    const payloadSegment = base64UrlEncode(JSON.stringify(payload));
    const signature = this.signSessionPayload(payloadSegment);

    return `${payloadSegment}.${signature}`;
  }

  validatePublicSessionToken(token: string, expectedShareToken: string): { valid: boolean; reason?: string } {
    if (!token || !token.includes('.')) {
      return { valid: false, reason: 'Sessão inválida' };
    }

    const [payloadSegment, signature] = token.split('.');
    if (!payloadSegment || !signature) {
      return { valid: false, reason: 'Sessão inválida' };
    }

    if (!this.verifySessionSignature(payloadSegment, signature)) {
      return { valid: false, reason: 'Sessão inválida' };
    }

    try {
      const payload = JSON.parse(base64UrlDecode(payloadSegment)) as PublicAccessSessionPayload;
      const nowSeconds = Math.floor(Date.now() / 1000);

      if (payload.aud !== SESSION_AUDIENCE) {
        return { valid: false, reason: 'Sessão inválida' };
      }

      if (payload.shareToken !== expectedShareToken) {
        return { valid: false, reason: 'Sessão inválida' };
      }

      if (payload.exp <= nowSeconds) {
        return { valid: false, reason: 'Sessão expirada' };
      }

      return { valid: true };
    } catch {
      return { valid: false, reason: 'Sessão inválida' };
    }
  }

  async validateAccess(shareToken: string, email?: string, password?: string) {
    const { data: share } = await this.supabase
      .from('report_shares')
      .select('*')
      .eq('share_token', shareToken)
      .eq('is_active', true)
      .single();

    if (!share) {
      return { valid: false, reason: 'Link de acesso inválido ou expirado' };
    }

    // Hard-block obrigatório: compartilhamento expirado não pode acessar dados.
    if (share.expires_at && new Date(share.expires_at).getTime() <= Date.now()) {
      return { valid: false, reason: 'Link expirado' };
    }

    // Se o share for "protected", exige credenciais que batem com as gravadas no próprio share
    if (share.access_type === 'protected') {
      if (!email || !password) {
        return { valid: false, reason: 'Credenciais obrigatórias para este relatório' };
      }

      if (!share.contractor_email || !share.password_hash) {
        return { valid: false, reason: 'Este link ainda não possui credenciais configuradas' };
      }

      if (share.contractor_email.toLowerCase() !== email.toLowerCase()) {
        return { valid: false, reason: 'Credenciais inválidas' };
      }

      const passwordMatch = await bcrypt.compare(password, share.password_hash);
      if (!passwordMatch) {
        return { valid: false, reason: 'Credenciais inválidas' };
      }
    }

    return { valid: true, share };
  }

  /**
   * Configura ou atualiza as credenciais do contratante diretamente no share.
   * Usado quando o pesquisador gera o link protegido para o contratante.
   */
  async setContractorCredentials(shareId: string, email: string, password: string, name?: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await this.supabase
      .from('report_shares')
      .update({
        contractor_email: email,
        password_hash: passwordHash,
        contractor_name: name || null,
        access_type: 'protected', // força protected quando credenciais são definidas
        updated_at: new Date().toISOString(),
      })
      .eq('id', shareId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Cria um novo share link (chamado tipicamente pelo pesquisador/admin da tenant).
   */
  async createShare(params: {
    surveyId: string;
    tenantId: string;
    reportConfigurationId?: string;
    accessType?: 'protected' | 'public';
    expiresAt?: string;
  }) {
    const shareToken = this.generateSecureToken();

    const { data, error } = await this.supabase
      .from('report_shares')
      .insert({
        survey_id: params.surveyId,
        tenant_id: params.tenantId,
        report_configuration_id: params.reportConfigurationId || null,
        access_type: params.accessType || 'protected',
        share_token: shareToken,
        expires_at: params.expiresAt || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  private generateSecureToken(): string {
    return randomBytes(32).toString('hex');
  }
}

export const publicReportAccessService = new PublicReportAccessService();