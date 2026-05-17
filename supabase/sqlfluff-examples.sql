-- Exemplo de SQL bem formatado com SQLFluff
-- Dialeto: PostgreSQL
-- Data: 17 de maio de 2026

-- Exemplo 1: SELECT simples
SELECT
  id,
  name,
  email
FROM users
WHERE created_at > (NOW() - INTERVAL '30 days')
ORDER BY created_at DESC;

-- Exemplo 2: JOIN com múltiplas tabelas
SELECT
  u.id,
  u.name,
  s.title AS survey_title,
  COUNT(ra.id) AS response_count
FROM users AS u
INNER JOIN surveys AS s ON u.id = s.user_id
LEFT JOIN response_answers AS ra ON s.id = ra.survey_id
WHERE s.status = 'active'
  AND u.tenant_id = '123'
GROUP BY u.id, u.name, s.title
ORDER BY response_count DESC;

-- Exemplo 3: CTE (Common Table Expression)
WITH active_surveys AS (
  SELECT
    id,
    title,
    user_id,
    created_at
  FROM surveys
  WHERE status = 'active'
    AND deleted_at IS NULL
),
survey_stats AS (
  SELECT
    survey_id,
    COUNT(DISTINCT user_id) AS respondent_count,
    AVG(CAST(created_at AS DATE)) AS avg_response_date
  FROM responses
  WHERE status = 'completed'
  GROUP BY survey_id
)
SELECT
  s.id,
  s.title,
  s.user_id,
  COALESCE(ss.respondent_count, 0) AS respondents
FROM active_surveys AS s
LEFT JOIN survey_stats AS ss ON s.id = ss.survey_id
ORDER BY respondents DESC;

-- Exemplo 4: Inserção com valores múltiplos
INSERT INTO audit_log (
  user_id,
  action,
  resource_type,
  resource_id,
  timestamp
) VALUES
  (1, 'CREATE', 'survey', 101, NOW()),
  (1, 'UPDATE', 'survey', 101, NOW()),
  (2, 'DELETE', 'response', 201, NOW());

-- Exemplo 5: UPDATE com WHERE complexo
UPDATE surveys
SET
  status = 'completed',
  completed_at = NOW(),
  updated_at = NOW()
WHERE id = 42
  AND tenant_id = '123'
  AND deleted_at IS NULL;

-- Exemplo 6: Função com argumentos
SELECT
  ST_Distance(
    location,
    ST_GeomFromText('POINT(0 0)', 4326)
  ) AS distance
FROM locations
WHERE ST_DWithin(
  location,
  ST_GeomFromText('POINT(0 0)', 4326),
  1000
);

-- Exemplo 7: CASE statement
SELECT
  id,
  name,
  CASE
    WHEN status = 'active' THEN 'Em andamento'
    WHEN status = 'completed' THEN 'Concluído'
    WHEN status = 'archived' THEN 'Arquivado'
    ELSE 'Desconhecido'
  END AS status_label
FROM surveys;

-- Exemplo 8: Subquery
SELECT
  id,
  name,
  (
    SELECT COUNT(*)
    FROM responses
    WHERE responses.survey_id = surveys.id
  ) AS response_count
FROM surveys
WHERE id IN (SELECT DISTINCT survey_id FROM responses);

-- Exemplo 9: Window Functions
SELECT
  id,
  name,
  created_at,
  ROW_NUMBER() OVER (ORDER BY created_at DESC) AS rn,
  RANK() OVER (PARTITION BY tenant_id ORDER BY created_at DESC) AS rnk
FROM surveys;

-- Exemplo 10: Comments para desabilitar regras
-- sqlfluff:noqa:LT01
SELECT  col1  FROM  users;  -- Desabilita regra L001 (espaçamento)
