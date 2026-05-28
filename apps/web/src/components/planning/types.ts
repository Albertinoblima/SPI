/**
 * Tipos para o módulo de Base Geográfica no Planejamento de Pesquisa.
 *
 * Esta estrutura foi desenhada para ser:
 * - Reutilizável com o sistema existente (survey-decisions.ts)
 * - Extensível para suportar Localidades + dados TSE/IBGE no futuro
 * - Simples o suficiente para o fluxo de Planejamento (sem o Passo 3)
 */

import type { GeoLevel, GeoScope, PopulationType } from '@/lib/survey-decisions';

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
}

/**
 * Representa um município na base geográfica do planejamento.
 */
export interface PlanningMunicipality {
  ibge_id?: number;
  name: string;
  uf: string;
  population?: number;
  localities?: PlanningLocality[]; // Futuro: localidades dentro do município
}

/**
 * Estrutura principal salva em: planning_data.geographic_base
 */
export interface GeographicBase {
  scope: GeoScope | 'mixed';
  municipalities: PlanningMunicipality[];
  localities?: PlanningLocality[]; // Suporte futuro a seleção direta de localidades
  metadata?: {
    total_population?: number;
    total_electorate?: number;
    research_type?: string;
    selected_at?: string;
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
