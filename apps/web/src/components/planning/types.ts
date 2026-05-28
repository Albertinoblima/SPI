/**
 * Tipos para o módulo de Base Geográfica no Planejamento de Pesquisa.
 *
 * Esta estrutura foi desenhada para ser:
 * - Reutilizável com o sistema existente (survey-decisions.ts)
 * - Extensível para suportar Localidades + dados TSE/IBGE no futuro
 * - Simples o suficiente para o fluxo de Planejamento (sem o Passo 3)
 */

import type { GeoLevel, GeoScope } from '@/lib/survey-decisions';

// População type é definido em surveys mas usamos string aqui para evitar acoplamento forte
type PopulationType = string;

/**
 * Representa uma localidade (pode ser município ou localidade mais granular).
 */
export interface PlanningLocality {
  id?: string | number;
  name: string;
  geo_level: GeoLevel;
  parent_state_name?: string | null;
  parent_city_name?: string | null;
  zone?: 'urban' | 'rural' | 'mixed';
  population?: number;
  population_type?: PopulationType;
  ibge_id?: number;
  tse_code?: string;

  // Dados enriquecidos opcionais (CNEFE / Censo por localidade)
  residences_cnefe?: number;
  electorate?: number;
}

/**
 * Representa um município na base geográfica do planejamento.
 * Suporta dados enriquecidos vindos de /api/geo/municipality-profile (Fase 1 Geo Enrichment).
 */
export interface PlanningMunicipality {
  ibge_id?: number;
  name: string;
  uf: string;
  population?: number;
  localities?: PlanningLocality[];

  // === Campos enriquecidos (opcionais) ===
  enriched?: {
    population_census?: number;
    electorate_total?: number;
    residences_cnefe?: number;
    data_quality_score?: number; // 0-3
    has_census?: boolean;
    has_tse?: boolean;
    has_cnefe?: boolean;
    sources?: string[];
  };
}

/**
 * Estrutura principal salva em: planning_data.geographic_base
 */
export interface GeographicBase {
  scope: GeoScope | 'mixed';
  municipalities: PlanningMunicipality[];
  localities?: PlanningLocality[];
  metadata?: {
    total_population?: number;
    total_electorate?: number;
    research_type?: string;
    selected_at?: string;
    // Fase 1 - Geo Enrichment
    used_enriched_data?: boolean;
    data_quality_summary?: string;
  };
}

/**
 * Tipo usado durante a seleção (no componente).
 */
export interface GeographicBaseSelection {
  scope: GeoScope | 'mixed';
  municipalities: PlanningMunicipality[];
  localities: PlanningLocality[];
}
