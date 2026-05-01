# Referência da API

## Edge Functions (Supabase)

### POST /functions/v1/sync-responses

Sincroniza respostas coletadas offline em lote.

**Headers:**

- `Authorization: Bearer <token>`

**Body:**

```json
{
  "responses": [
    {
      "id": "uuid",
      "survey_id": "uuid",
      "answers": [...],
      "geolocation": {
        "latitude": -23.5505,
        "longitude": -46.6333,
        "accuracy": 10
      },
      "started_at": "2024-01-01T00:00:00Z",
      "completed_at": "2024-01-01T00:05:00Z",
      "local_id": "local_abc123"
    }
  ]
}
```

**Response:**

```json
{
  "synced": 5,
  "failed": 0,
  "errors": []
}
```

---

### POST /functions/v1/process-media

Upload e processamento de mídia (fotos, áudios).

**Headers:**

- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Body (FormData):**

- `file`: Arquivo de mídia
- `response_id`: UUID da resposta
- `question_id`: UUID da pergunta

**Response:**

```json
{
  "url": "https://...",
  "path": "responses/uuid/uuid.jpg"
}
```

---

### POST /functions/v1/generate-analytics

Gera analytics para uma pesquisa específica.

**Headers:**

- `Authorization: Bearer <token>`

**Body:**

```json
{
  "survey_id": "uuid"
}
```

**Response:**

```json
{
  "total_responses": 150,
  "completion_rate": 0.95,
  "responses_by_day": {
    "2024-01-01": 25,
    "2024-01-02": 30
  },
  "geolocation_points": [
    { "lat": -23.5505, "lng": -46.6333 }
  ]
}
```

## Tabelas do Banco de Dados

| Tabela | Descrição |
|---|---|
| tenants | Organizações (multi-tenant) |
| users | Pesquisadores e administradores |
| surveys | Pesquisas configuráveis |
| questions | Perguntas dinâmicas |
| responses | Respostas coletadas |
| sync_log | Log de sincronização |
