'use client';

import { useState, useEffect, useRef, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Building2, Save, CheckCircle, AlertCircle, Loader2, Image as ImageIcon, PartyPopper, Trash2 } from 'lucide-react';

interface TenantData {
    id: string;
    name: string;
    nome_fantasia: string;
    slug: string;
    cnpj: string;
    phone: string;
    email: string;
    website: string;
    logo_url: string;
    address: string;
    address_number: string;
    address_complement: string;
    neighborhood: string;
    city: string;
    state: string;
    zip_code: string;
    responsavel_tecnico: string;
    max_users: number;
    max_surveys: number;
    status: string;
}

type CompanyAssetType = 'logo_sem_slogan' | 'logo_com_slogan' | 'logo_alternativa';

interface CompanyAsset {
    id: string;
    asset_type: CompanyAssetType;
    file_url: string;
    is_active: boolean;
    created_at: string;
}

const ASSET_TYPE_LABELS: Record<CompanyAssetType, string> = {
    logo_sem_slogan: 'Logo sem slogan',
    logo_com_slogan: 'Logo com slogan',
    logo_alternativa: 'Logo alternativa',
};

const ESTADOS_BR = [
    'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG',
    'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

function formatCNPJ(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 14);
    return digits
        .replace(/^(\d{2})(\d)/, '$1.$2')
        .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d)/, '.$1/$2')
        .replace(/(\d{4})(\d)/, '$1-$2');
}

function formatPhone(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 10) {
        return digits.replace(/^(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
    }
    return digits.replace(/^(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
}

function formatZip(value: string): string {
    const digits = value.replace(/\D/g, '').slice(0, 8);
    return digits.replace(/^(\d{5})(\d{0,3})/, '$1-$2');
}

export default function SettingsPage() {
    return (
        <Suspense>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const isOnboarding = searchParams.get('onboarding') === '1';

    const [tenant, setTenant] = useState<TenantData | null>(null);
    const [form, setForm] = useState<Partial<TenantData>>({});
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploadingLogo, setUploadingLogo] = useState(false);
    const [uploadingAssetType, setUploadingAssetType] = useState<CompanyAssetType | null>(null);
    const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
    const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [companyAssets, setCompanyAssets] = useState<CompanyAsset[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        fetchTenant();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchTenant() {
        setLoading(true);
        try {
            const [companyRes, assetsRes] = await Promise.all([
                fetch('/api/settings/company'),
                fetch('/api/settings/company-assets'),
            ]);

            const companyJson = await companyRes.json();
            const assetsJson = await assetsRes.json();

            if (companyRes.ok && companyJson.data?.tenant) {
                setTenant(companyJson.data.tenant);
                setForm(companyJson.data.tenant);
                if (companyJson.data.tenant.logo_url) setLogoPreview(companyJson.data.tenant.logo_url);
            }

            if (assetsRes.ok && Array.isArray(assetsJson.data?.assets)) {
                setCompanyAssets(assetsJson.data.assets);
            }
        } catch {
            showAlert('error', 'Erro ao carregar dados da empresa');
        } finally {
            setLoading(false);
        }
    }

    function showAlert(type: 'success' | 'error', message: string) {
        setAlert({ type, message });
        setTimeout(() => setAlert(null), 4000);
    }

    function handleChange(field: keyof TenantData, value: string) {
        setForm(prev => ({ ...prev, [field]: value }));
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/settings/company', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            const json = await res.json();
            if (res.ok) {
                if (isOnboarding) {
                    // Onboarding concluído — ir para o dashboard
                    router.push('/dashboard?welcome=1');
                    return;
                }
                showAlert('success', 'Dados da empresa salvos com sucesso!');
                fetchTenant();
            } else {
                showAlert('error', json.error || 'Erro ao salvar');
            }
        } catch {
            showAlert('error', 'Erro de conexão');
        } finally {
            setSaving(false);
        }
    }

    async function handleLogoUpload(file: File) {
        setUploadingLogo(true);
        try {
            const data = new FormData();
            data.append('logo', file);
            const res = await fetch('/api/settings/logo', { method: 'POST', body: data });
            const json = await res.json();
            if (res.ok) {
                setLogoPreview(json.data.logo_url);
                showAlert('success', 'Logomarca atualizada com sucesso!');
            } else {
                showAlert('error', json.error || 'Erro ao enviar logomarca');
            }
        } catch {
            showAlert('error', 'Erro ao enviar logomarca');
        } finally {
            setUploadingLogo(false);
        }
    }

    function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;
        const preview = URL.createObjectURL(file);
        setLogoPreview(preview);
        handleLogoUpload(file);
    }

    async function handleAssetUpload(assetType: CompanyAssetType, file: File) {
        setUploadingAssetType(assetType);
        try {
            const data = new FormData();
            data.append('asset_type', assetType);
            data.append('file', file);

            const res = await fetch('/api/settings/company-assets', {
                method: 'POST',
                body: data,
            });

            const json = await res.json();
            if (!res.ok) {
                showAlert('error', json.error || 'Erro ao enviar asset');
                return;
            }

            showAlert('success', `${ASSET_TYPE_LABELS[assetType]} atualizada com sucesso!`);
            await fetchTenant();
        } catch {
            showAlert('error', 'Erro ao enviar asset');
        } finally {
            setUploadingAssetType(null);
        }
    }

    async function handleAssetDelete(assetId: string) {
        setDeletingAssetId(assetId);
        try {
            const res = await fetch(`/api/settings/company-assets?id=${encodeURIComponent(assetId)}`, {
                method: 'DELETE',
            });
            const json = await res.json();

            if (!res.ok) {
                showAlert('error', json.error || 'Erro ao remover asset');
                return;
            }

            showAlert('success', 'Asset removido com sucesso!');
            await fetchTenant();
        } catch {
            showAlert('error', 'Erro ao remover asset');
        } finally {
            setDeletingAssetId(null);
        }
    }

    const activeAssetsByType = companyAssets.reduce((acc, asset) => {
        if (asset.is_active && !acc[asset.asset_type]) {
            acc[asset.asset_type] = asset;
        }
        return acc;
    }, {} as Partial<Record<CompanyAssetType, CompanyAsset>>);

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 max-w-4xl">
            {/* Banner de boas-vindas no onboarding */}
            {isOnboarding && (
                <div className="mb-6 bg-gradient-to-r from-blue-600 to-blue-700 rounded-2xl p-6 text-white shadow-lg">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
                            <PartyPopper className="w-6 h-6 text-white" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold mb-1">Bem-vindo ao iDialog SPI! 🎉</h2>
                            <p className="text-blue-100 text-sm leading-relaxed">
                                Antes de começar, precisamos configurar os dados da sua empresa.
                                Essas informações aparecerão nos cabeçalhos e rodapés de todos os relatórios de pesquisa.
                                Leva menos de 2 minutos!
                            </p>
                            <div className="mt-3 flex items-center gap-2 text-sm text-blue-200">
                                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">1</span>
                                <span>Preencha os dados abaixo</span>
                                <span className="mx-1">→</span>
                                <span className="w-5 h-5 bg-white/20 rounded-full flex items-center justify-center text-xs font-bold">2</span>
                                <span>Clique em Salvar e ir para Início</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Cabeçalho */}
            <div className="flex items-center gap-3 mb-6 sm:mb-8">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-slate-900">
                        {isOnboarding ? 'Configure sua Empresa' : 'Configurações da Empresa'}
                    </h1>
                    <p className="text-sm text-slate-500">Dados utilizados nos relatórios de pesquisa</p>
                </div>
            </div>

            {/* Alerta */}
            {alert && (
                <div className={`mb-6 flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${alert.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}>
                    {alert.type === 'success'
                        ? <CheckCircle className="w-4 h-4 shrink-0" />
                        : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {alert.message}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Logomarca */}
                <div className="lg:col-span-1">
                    <div className="bg-white rounded-xl border border-slate-200 p-6">
                        <h2 className="font-semibold text-slate-900 mb-4">Logomarca</h2>
                        <div
                            className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors min-h-[180px]"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            {uploadingLogo ? (
                                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                            ) : logoPreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                    src={logoPreview}
                                    alt="Logomarca"
                                    className="max-h-28 max-w-full object-contain"
                                />
                            ) : (
                                <ImageIcon className="w-12 h-12 text-slate-300" />
                            )}
                            <p className="text-xs text-slate-500 text-center">
                                {uploadingLogo ? 'Enviando...' : 'Clique para fazer upload'}
                            </p>
                            <p className="text-xs text-slate-400 text-center">PNG, JPG, WebP, SVG · redimensionado automaticamente</p>
                        </div>
                        <input
                            ref={fileInputRef}
                            type="file"
                            aria-label="Upload da logomarca"
                            accept="image/jpeg,image/png,image/webp,image/svg+xml"
                            className="hidden"
                            onChange={handleFileChange}
                        />

                        <div className="mt-5 space-y-4">
                            <h3 className="text-sm font-semibold text-slate-800">Assets de marca</h3>
                            {(Object.keys(ASSET_TYPE_LABELS) as CompanyAssetType[]).map((assetType) => {
                                const activeAsset = activeAssetsByType[assetType];
                                return (
                                    <div key={assetType} className="border border-slate-200 rounded-lg p-3">
                                        <p className="text-xs font-medium text-slate-600 mb-2">{ASSET_TYPE_LABELS[assetType]}</p>
                                        <div className="flex items-center gap-2">
                                            <label className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-1 rounded cursor-pointer transition-colors">
                                                {uploadingAssetType === assetType ? 'Enviando...' : 'Enviar'}
                                                <input
                                                    type="file"
                                                    accept="image/jpeg,image/png,image/webp,image/svg+xml"
                                                    className="hidden"
                                                    disabled={uploadingAssetType !== null}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0];
                                                        if (file) handleAssetUpload(assetType, file);
                                                        e.currentTarget.value = '';
                                                    }}
                                                />
                                            </label>
                                            {activeAsset && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleAssetDelete(activeAsset.id)}
                                                    disabled={deletingAssetId === activeAsset.id}
                                                    className="text-xs text-red-600 hover:text-red-700 disabled:text-red-300"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>
                                        <div className="mt-2 h-14 border border-dashed border-slate-200 rounded flex items-center justify-center bg-slate-50 overflow-hidden">
                                            {activeAsset ? (
                                                // eslint-disable-next-line @next/next/no-img-element
                                                <img src={activeAsset.file_url} alt={ASSET_TYPE_LABELS[assetType]} className="max-h-12 object-contain" />
                                            ) : (
                                                <span className="text-[11px] text-slate-400">Nenhum arquivo ativo</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Plano */}
                        {tenant && (
                            <div className="mt-6 p-4 bg-slate-50 rounded-lg space-y-2">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Plano atual</p>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Usuários</span>
                                    <span className="font-medium text-slate-800">até {tenant.max_users}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Pesquisas</span>
                                    <span className="font-medium text-slate-800">até {tenant.max_surveys}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-600">Status</span>
                                    <span className={`font-medium ${tenant.status === 'active' ? 'text-green-600' : 'text-amber-600'}`}>
                                        {tenant.status === 'active' ? 'Ativo' : tenant.status === 'trial' ? 'Trial' : 'Suspenso'}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Formulário */}
                <div className="lg:col-span-2">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* Dados básicos */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h2 className="font-semibold text-slate-900 mb-4">Dados da Empresa</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Razão Social / Nome da Empresa <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={form.name ?? ''}
                                        onChange={e => handleChange('name', e.target.value)}
                                        required
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ex: Empresa de Pesquisa Ltda"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome Fantasia</label>
                                    <input
                                        type="text"
                                        value={form.nome_fantasia ?? ''}
                                        onChange={e => handleChange('nome_fantasia', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Ex: iDialog Pesquisas"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CNPJ</label>
                                    <input
                                        type="text"
                                        value={form.cnpj ?? ''}
                                        onChange={e => handleChange('cnpj', formatCNPJ(e.target.value))}
                                        maxLength={18}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="00.000.000/0001-00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Telefone</label>
                                    <input
                                        type="text"
                                        value={form.phone ?? ''}
                                        onChange={e => handleChange('phone', formatPhone(e.target.value))}
                                        maxLength={16}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="(00) 90000-0000"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">E-mail Corporativo</label>
                                    <input
                                        type="email"
                                        value={form.email ?? ''}
                                        onChange={e => handleChange('email', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="contato@empresa.com.br"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Website</label>
                                    <input
                                        type="url"
                                        value={form.website ?? ''}
                                        onChange={e => handleChange('website', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://www.empresa.com.br"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Responsável Técnico</label>
                                    <input
                                        type="text"
                                        value={form.responsavel_tecnico ?? ''}
                                        onChange={e => handleChange('responsavel_tecnico', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Nome do responsável técnico pelas pesquisas"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Endereço */}
                        <div className="bg-white rounded-xl border border-slate-200 p-6">
                            <h2 className="font-semibold text-slate-900 mb-4">Endereço</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-6 gap-4">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                                    <input
                                        type="text"
                                        value={form.zip_code ?? ''}
                                        onChange={e => handleChange('zip_code', formatZip(e.target.value))}
                                        maxLength={9}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="00000-000"
                                    />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Logradouro</label>
                                    <input
                                        type="text"
                                        value={form.address ?? ''}
                                        onChange={e => handleChange('address', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Rua, Avenida, etc."
                                    />
                                </div>
                                <div className="sm:col-span-1">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Número</label>
                                    <input
                                        type="text"
                                        value={form.address_number ?? ''}
                                        onChange={e => handleChange('address_number', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Nº"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                                    <input
                                        type="text"
                                        value={form.address_complement ?? ''}
                                        onChange={e => handleChange('address_complement', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Sala, andar..."
                                    />
                                </div>
                                <div className="sm:col-span-3">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Bairro</label>
                                    <input
                                        type="text"
                                        value={form.neighborhood ?? ''}
                                        onChange={e => handleChange('neighborhood', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Bairro"
                                    />
                                </div>
                                <div className="sm:col-span-4">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Cidade</label>
                                    <input
                                        type="text"
                                        value={form.city ?? ''}
                                        onChange={e => handleChange('city', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Cidade"
                                    />
                                </div>
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Estado</label>
                                    <select
                                        aria-label="Estado"
                                        value={form.state ?? ''}
                                        onChange={e => handleChange('state', e.target.value)}
                                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                                    >
                                        <option value="">UF</option>
                                        {ESTADOS_BR.map(uf => (
                                            <option key={uf} value={uf}>{uf}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Botão salvar */}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors text-sm"
                            >
                                {saving ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving
                                    ? 'Salvando...'
                                    : isOnboarding
                                        ? 'Salvar e ir para Início →'
                                        : 'Salvar Dados'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
