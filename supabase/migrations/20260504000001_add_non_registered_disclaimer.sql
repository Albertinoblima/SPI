-- Adiciona coluna para termo de responsabilidade quando a pesquisa não tem responsável técnico registrado
ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS non_registered_disclaimer text DEFAULT '' NOT NULL;
