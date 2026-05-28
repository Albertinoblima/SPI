-- ============================================================================
-- RELATÓRIOS AVANÇADOS - FUNDAÇÃO (Fase 1)
-- Data: 2026-05-28
-- Objetivo: Criar estrutura para suportar Relatórios .docx avançados e Dashboard Dinâmico
-- ============================================================================

-- 1. Estender questions com preferências de visualização
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS preferred_visualization VARCHAR(50),
ADD COLUMN IF NOT EXISTS visualization_options JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.questions.preferred_visualization IS 
'Tipo de gráfico preferido para esta pergunta (bar, pie, line, table, map, etc). Definido no wizard.';

COMMENT ON COLUMN public.questions.visualization_options IS 
'Configurações adicionais de visualização (ex: cores, mostrar percentual, agrupar, etc).';

-- 2. Templates de Capa (reutilizáveis por tenant)
CREATE TABLE IF NOT EXISTS public.report_cover_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    name VARCHAR(120) NOT NULL,
    description TEXT,

    -- Configuração da capa
    layout_type VARCHAR(30) NOT NULL DEFAULT 'standard', -- standard, modern, institutional, custom
    background_image_url TEXT,
    logo_position VARCHAR(20) DEFAULT 'top-center', -- top-left, top-center, top-right, bottom, etc.

    -- Estilos
    primary_color VARCHAR(7) DEFAULT '#1E3A8A',
    secondary_color VARCHAR(7) DEFAULT '#374151',
    font_family VARCHAR(50) DEFAULT 'Arial',

    is_active BOOLEAN DEFAULT TRUE,
    is_default BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT report_cover_templates_layout_check 
        CHECK (layout_type IN ('standard', 'modern', 'institutional', 'minimal', 'custom'))
);

CREATE INDEX idx_report_cover_templates_tenant ON public.report_cover_templates(tenant_id);

-- 3. Configurações de Relatório (o que o usuário salva)
CREATE TABLE IF NOT EXISTS public.report_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    created_by UUID REFERENCES public.users (id),

    name VARCHAR(150) NOT NULL, -- Ex: "Relatório Analítico - Intenção de Voto"
    report_type VARCHAR(30) NOT NULL, -- synthetic, analytical, consolidated

    -- Configurações de impressão
    page_size VARCHAR(20) DEFAULT 'A4', -- A4, Letter, A3
    page_orientation VARCHAR(10) DEFAULT 'portrait', -- portrait, landscape
    paper_type VARCHAR(30) DEFAULT 'standard', -- standard, recycled, premium

    margins JSONB DEFAULT '{"top": 2.5, "bottom": 2.5, "left": 2, "right": 2}'::jsonb, -- em cm

    -- Capa
    cover_template_id UUID REFERENCES public.report_cover_templates(id),
    custom_cover_data JSONB, -- imagens extras, mapa, etc.

    -- Conteúdo
    include_toc BOOLEAN DEFAULT TRUE,
    include_methodology BOOLEAN DEFAULT TRUE,
    include_planning_metadata BOOLEAN DEFAULT TRUE,

    -- Para relatório analítico
    selected_crossings JSONB, -- array de objetos: [{ variables: ["gender", "age_group"], title: "..." }]

    -- Estilo
    heading_style VARCHAR(30) DEFAULT 'microsoft_word', -- microsoft_word, clean, formal
    color_scheme VARCHAR(30) DEFAULT 'professional',

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_report_configurations_survey ON public.report_configurations(survey_id);
CREATE INDEX idx_report_configurations_tenant ON public.report_configurations(tenant_id);

-- 4. Compartilhamento de Relatórios (para contratantes)
CREATE TABLE IF NOT EXISTS public.report_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_configuration_id UUID NOT NULL REFERENCES public.report_configurations(id) ON DELETE CASCADE,
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    -- Tipo de acesso
    access_type VARCHAR(20) NOT NULL DEFAULT 'protected', -- public (raro), protected, private

    -- Token para acesso anônimo (se necessário)
    share_token VARCHAR(64) UNIQUE,

    -- Credenciais do contratante (quando access_type = protected)
    contractor_email VARCHAR(255),
    contractor_name VARCHAR(150),
    password_hash TEXT, -- bcrypt

    -- Controle de acesso
    expires_at TIMESTAMPTZ,
    max_access_count INTEGER,
    current_access_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT TRUE,

    created_at TIMESTAMPTZ DEFAULT now(),
    last_accessed_at TIMESTAMPTZ,

    CONSTRAINT report_shares_access_type_check 
        CHECK (access_type IN ('public', 'protected', 'private'))
);

CREATE INDEX idx_report_shares_survey ON public.report_shares(survey_id);
CREATE INDEX idx_report_shares_token ON public.report_shares(share_token);
CREATE INDEX idx_report_shares_contractor_email ON public.report_shares(contractor_email);

-- 5. Logs de acesso aos relatórios (governança)
CREATE TABLE IF NOT EXISTS public.report_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_share_id UUID REFERENCES public.report_shares(id) ON DELETE SET NULL,
    survey_id UUID NOT NULL REFERENCES public.surveys (id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,

    accessed_by_email VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    access_type VARCHAR(30), -- 'docx_download', 'dynamic_dashboard_view'

    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_report_access_logs_survey ON public.report_access_logs(survey_id);
CREATE INDEX idx_report_access_logs_created ON public.report_access_logs(created_at DESC);

-- 6. Views úteis para agregação (serão expandidas)

-- View simples de totais por pergunta
CREATE OR REPLACE VIEW public.vw_survey_question_totals AS
SELECT 
    q.survey_id,
    q.id AS question_id,
    q.question_text,
    q.question_type,
    COUNT(ra.id) AS total_answers
FROM public.questions q
LEFT JOIN public.response_answers ra ON ra.question_id = q.id
GROUP BY q.survey_id, q.id, q.question_text, q.question_type;

-- Trigger para updated_at
CREATE TRIGGER update_report_cover_templates_updated_at 
    BEFORE UPDATE ON public.report_cover_templates 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_report_configurations_updated_at 
    BEFORE UPDATE ON public.report_configurations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Comentários finais
COMMENT ON TABLE public.report_cover_templates IS 'Modelos de capa reutilizáveis para relatórios .docx';
COMMENT ON TABLE public.report_configurations IS 'Configurações salvas de relatórios (tipos, cruzamentos, layout)';
COMMENT ON TABLE public.report_shares IS 'Compartilhamento seguro de relatórios com contratantes (com autenticação)';
COMMENT ON TABLE public.report_access_logs IS 'Auditoria de acesso aos relatórios (governança)';

-- Fim da migração de Fundação