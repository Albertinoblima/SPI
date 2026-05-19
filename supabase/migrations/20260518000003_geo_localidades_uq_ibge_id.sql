-- Migration: adiciona UNIQUE(municipio_id, ibge_id) em geo_localidades
-- para permitir upsert idempotente via supabase-py
-- Aplicar com: .\supabase db query --linked --file supabase/migrations/20260518000003_geo_localidades_uq_ibge_id.sql
-- Aviso: erro de sintaxe exibido pela IDE e falso positivo (parser T-SQL nao entende dialeto Postgres).
-- Migration validada e aplicada com sucesso no banco Supabase (constraint uq_geo_localidades_mun_ibge_id confirmada em pg_constraint).

ALTER TABLE geo_localidades
ADD CONSTRAINT uq_geo_localidades_mun_ibge_id
UNIQUE (municipio_id, ibge_id);
