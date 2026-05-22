-- Add trade name and company assets catalog for brand management

ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS nome_fantasia VARCHAR(255);

CREATE TABLE IF NOT EXISTS public.company_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants (id) ON DELETE CASCADE,
    asset_type VARCHAR(40) NOT NULL CHECK (asset_type IN (
        'logo_sem_slogan',
        'logo_com_slogan',
        'logo_alternativa'
    )),
    file_url TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users (id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_assets_tenant_id ON public.company_assets (tenant_id);
CREATE INDEX IF NOT EXISTS idx_company_assets_tenant_type ON public.company_assets (tenant_id, asset_type);
CREATE INDEX IF NOT EXISTS idx_company_assets_active ON public.company_assets (tenant_id, is_active);

ALTER TABLE public.company_assets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_assets_select_policy" ON public.company_assets;
CREATE POLICY "company_assets_select_policy" ON public.company_assets
FOR SELECT
USING (
    tenant_id IN (
        SELECT tenant_id
        FROM public.users
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "company_assets_insert_policy" ON public.company_assets;
CREATE POLICY "company_assets_insert_policy" ON public.company_assets
FOR INSERT
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id
        FROM public.users
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "company_assets_update_policy" ON public.company_assets;
CREATE POLICY "company_assets_update_policy" ON public.company_assets
FOR UPDATE
USING (
    tenant_id IN (
        SELECT tenant_id
        FROM public.users
        WHERE id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT tenant_id
        FROM public.users
        WHERE id = auth.uid()
    )
);

DROP POLICY IF EXISTS "company_assets_delete_policy" ON public.company_assets;
CREATE POLICY "company_assets_delete_policy" ON public.company_assets
FOR DELETE
USING (
    tenant_id IN (
        SELECT tenant_id
        FROM public.users
        WHERE id = auth.uid()
    )
);
