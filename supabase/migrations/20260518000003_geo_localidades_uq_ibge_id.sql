-- Migration: adiciona UNIQUE(municipio_id, ibge_id) em geo_localidades
-- para permitir upsert idempotente via supabase-py
-- Aplicar com: .\supabase db query --linked --file supabase/migrations/20260518000003_geo_localidades_uq_ibge_id.sql

ALTER TABLE geo_localidades
    ADD CONSTRAINT uq_geo_localidades_mun_ibge_id
    UNIQUE (municipio_id, ibge_id);
