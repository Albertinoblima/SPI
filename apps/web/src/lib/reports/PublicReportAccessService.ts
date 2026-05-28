/**
 * PublicReportAccessService
 * 
 * Gerencia acesso protegido aos relatórios dinâmicos por parte dos contratantes.
 * 
 * Modelo de segurança recomendado:
 * - Cada relatório compartilhado tem um `share_token`
 * - O contratante pode ter credenciais (email + senha) vinculadas a esse share
 * - Acesso só é permitido se token + credenciais baterem
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
      return { valid: false, reason: 'Invalid or expired share link' };
    }

    // Se o share for "protected", exige credenciais
    if (share.access_type === 'protected') {
      if (!email || !password) {
        return { valid: false, reason: 'Credentials required' };
      }

      // Buscar credenciais do contratante
      const { data: contractor } = await this.supabase
        .from('report_contractors')
        .select('*')
        .eq('report_share_id', share.id)
        .eq('email', email)
        .single();

      if (!contractor) {
        return { valid: false, reason: 'Invalid credentials' };
      }

      const passwordMatch = await bcrypt.compare(password, contractor.password_hash);
      if (!passwordMatch) {
        return { valid: false, reason: 'Invalid credentials' };
      }
    }

    return { valid: true, share };
  }

  async createContractorAccess(shareId: string, email: string, password: string, name?: string) {
    const passwordHash = await bcrypt.hash(password, 10);

    const { data, error } = await this.supabase
      .from('report_contractors')
      .insert({
        report_share_id: shareId,
        email,
        password_hash: passwordHash,
        name,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}

export const publicReportAccessService = new PublicReportAccessService();