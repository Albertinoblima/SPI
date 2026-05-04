-- Adiciona coluna para categoria da pesquisa (quantitativa ou qualitativa)
ALTER TABLE surveys
ADD COLUMN IF NOT EXISTS research_category varchar(20) NOT NULL DEFAULT '';
