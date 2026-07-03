# RE-EXIST — Laboratório de Restauração Fotográfica com IA

Restaure fotografias antigas, rasgadas ou desbotadas com IA generativa (Google Gemini). Reparo estrutural, preservação de identidade facial e colorização histórica — com exportação profissional em PNG, JPG, TIFF ou PDF com certificado técnico.

**🌐 App em produção:** https://tarcisiorwzadvogados-tech.github.io/RE-Exist/

## Funcionalidades

- **4 protocolos de restauração**: reparo de estrutura, identidade facial, colorização histórica e colorização P&B
- **Pipeline em lote**: encadeie protocolos em sequência (output de um vira input do próximo) com barra de progresso
- **Comparação antes/depois**: lado a lado, slider arrastável e modo Prova (tela cheia)
- **Compartilhamento viral**: composite antes/depois pronto para redes sociais (Web Share API no mobile)
- **Exportação com metadados**: EXIF (JPG), XMP (TIFF), certificado técnico em PDF e recibo de custos da sessão
- **Suporte a TIFF**: decodificação completa via UTIF, qualquer tamanho de arquivo (Files API da Gemini até 2 GB)
- **Dois temas**: Lightroom (claro) e Darkroom (escuro)

## Arquitetura

Dois modos de operação para a chave da API Gemini:

| Modo | Como funciona | Quando usar |
|------|--------------|-------------|
| **BYOK** (padrão em produção) | Usuário insere a própria chave; fica só no `localStorage` do browser | Deploy estático sem backend (GitHub Pages) |
| **Proxy** | Backend Express guarda a chave; rate limit (10/15min por IP), teto diário de custo, fila de concorrência e retry com backoff | Tier gratuito com a sua chave server-side |

O cliente escolhe automaticamente: sem chave local, usa o proxy (se disponível). Imagens ≥ 6 MB sobem via Files API; menores vão inline. Imagens acima de 4 MB/4000px são comprimidas no browser antes do envio.

## Stack

React 19 · TypeScript · Vite 6 · Tailwind CSS 4 · Framer Motion · @google/genai · Express (proxy opcional) · Vitest

## Rodando localmente

**Pré-requisitos:** Node.js 20+

```bash
npm install
npm run dev          # frontend em http://localhost:3000 (modo BYOK)
```

Para o modo proxy (chave no servidor), em outro terminal:

```bash
cp .env.example .env      # preencha GEMINI_API_KEY
npm run server            # proxy em http://localhost:3001 (o Vite redireciona /api)
```

## Scripts

| Script | Função |
|--------|--------|
| `npm run dev` | dev server Vite (porta 3000) |
| `npm run server` | proxy Express (porta 3001) |
| `npm run build` | build de produção |
| `npm test` | 72 testes (Vitest + Testing Library + supertest) |
| `npm run ci` | typecheck + lint + format + test + build (mesmo pipeline do CI) |

## Qualidade e deploy contínuo

- **CI** ([ci.yml](.github/workflows/ci.yml)): typecheck, ESLint, Prettier, testes e build a cada push/PR
- **Deploy** ([deploy-pages.yml](.github/workflows/deploy-pages.yml)): publica no GitHub Pages a cada push na `main`
- **Produção com backend**: ver [DEPLOYMENT.md](DEPLOYMENT.md) (Vercel/Cloudflare Pages + Cloud Run com Dockerfile pronto)

## Estrutura

```
src/
├── App.tsx               orquestração (roteamento de API, restauração, pipeline)
├── components/           ApiKeyScreen, CropModal, BeforeAfterSlider, PipelinePanel, Header...
├── hooks/                useImageState, useSessionState, useUIState (reducers)
└── lib/                  gemini/share/download/pdf/tiff/analytics/utils (+ testes)
server.ts                 proxy Express: rate limit, fila, teto diário, logs estruturados
```
