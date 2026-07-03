# RE-EXIST — Runbook de Implantação

Arquitetura de produção: **frontend estático em CDN** + **proxy em container serverless** (opcional). Deploys independentes — o frontend nunca cai por causa do backend.

## 1. Frontend

### ✅ Ativo: GitHub Pages (modo BYOK)

**Produção atual:** https://tarcisiorwzadvogados-tech.github.io/RE-Exist/

Deploy automático a cada push na `main` via [deploy-pages.yml](.github/workflows/deploy-pages.yml) (build com `DEPLOY_BASE=/RE-Exist/`). Nesse modo cada usuário insere a própria chave Gemini (BYOK) — não há backend nem custo de servidor.

### Alternativa: Vercel ou Cloudflare Pages (quando ativar o proxy)

- **Vercel**: importar o repo → framework "Vite" → build `npm run build`, output `dist`.
- **Cloudflare Pages**: mesmo esquema (build command `npm run build`, output `dist`).
- Variáveis de build (opcionais): `POSTHOG_KEY`, `POSTHOG_HOST` (analytics), `GEMINI_API_KEY` **não** — nunca colocar a chave no build do frontend.
- Configurar rewrite de `/api/*` para a URL do proxy (Vercel: `vercel.json` rewrites; Pages: `_redirects`).

## 2. Proxy (Google Cloud Run)

```bash
gcloud run deploy re-exist-proxy \
  --source . \
  --region us-east1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=SEU_VALOR,DAILY_RESTORE_CAP=200
```

O `Dockerfile` já está pronto (multi-stage, tsx runtime). Env vars:

| Var | Default | Função |
|-----|---------|--------|
| `GEMINI_API_KEY` | — | chave do free tier (server-side) |
| `DAILY_RESTORE_CAP` | 200 | teto diário global de restaurações (controla custo máximo/dia) |
| `PORT` | 3001 | Cloud Run injeta automaticamente |
| `LOG_LEVEL` | info | pino |

Health check: `GET /api/health` (retorna fila, uso diário e memória).

## 3. Analytics (PostHog)

1. Criar projeto grátis em [posthog.com](https://posthog.com) (1M eventos/mês free)
2. Adicionar `POSTHOG_KEY=phc_...` nas variáveis de build do frontend
3. Funil pronto: `upload → restore_start → restore_success → download_*`; eventos extras: `restore_fail`, `pipeline_run`, `share_click`
4. Criar insights: funil de conversão, retenção por coorte (D1/D7/D30), taxa de erro por modelo

## 4. Fase longa (quando houver tração)

- **Supabase** (auth + histórico cross-device): substituir `restoration_history` do localStorage; quota por usuário substitui rate limit por IP
- **og:image**: gerar um asset estático `public/og.png` (composite antes/depois de exemplo) e adicionar `<meta property="og:image" ...>` no index.html
- **Tier pago**: Stripe + limite por conta; o BYOK atual já é a válvula de escape gratuita

## Verificação pós-deploy

```bash
curl https://SEU-PROXY/api/health        # 200 {"status":"ok",...}
curl https://SEU-PROXY/api/status        # {"proxyAvailable":true}
```

- Abrir o app, fazer upload → restore → download nos dois modos (proxy e BYOK)
- Lighthouse: SEO ≥ 90, Performance ≥ 85
- Flood test: 11+ POSTs em /api/restore → 429
