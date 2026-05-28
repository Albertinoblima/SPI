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

import { createAdminClient } from '@/lib/supabase/admin';
import bcrypt from 'bcryptjs';

export class PublicReportAccessService {
  private supabase = createAdminClient();

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
    // Token simples mas seguro o suficiente para v1 (64 chars hex)
    const array = new Uint8Array(32);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(array);
    } else {
      for (let i = 0; i < array.length; i++) array[i] = Math.floor(Math.random() * 256);
    }
    return Array.from(array, b => b.toString(16).padStart(2, '0')).join('');
  }
}

export const publicReportAccessService = new PublicReportAccessService();