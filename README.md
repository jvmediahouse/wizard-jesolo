# Wizart — Your Jesolo Guide

Assistente conversazionale per il portale turistico [jesolo.it](https://www.jesolo.it). Guida i visitatori attraverso un wizard mobile-first a bolle di chat e produce eventi locali rilevanti o un piano vacanza personalizzato (sport e outdoor, relax e mare, cultura, nightlife, bleisure, lifestyle, gite & territorio) con PDF scaricabile.

**Stack:** React (Vite) · TypeScript · Tailwind CSS · shadcn/ui · Supabase · OpenAI

---

## Documentazione

- [Documentazione tecnica](DOCUMENTATION.md) — architettura, hook, componenti, database, edge functions
- [Deploy su Cloudflare Pages](DEPLOY_CLOUDFLARE_STEPS.md) — guida passo passo per pubblicare il frontend
- [Replica schema Supabase](SUPABASE_NEW_PROJECT.md) — come replicare il progetto su un nuovo database Supabase

---

## Sviluppo locale

Requisito: Node.js 18+ (testato con node v24.14.1).

```sh
# Clona il repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Installa le dipendenze
npm install

# Avvia il dev server (http://localhost:8080)
npm run dev
```

---

## Deploy

Il frontend si deploya su **Cloudflare Pages** — ogni `git push origin main` triggera automaticamente una nuova build.
Il backend (Supabase: database, RLS, edge functions) si gestisce separatamente.

Vedi [DEPLOY_CLOUDFLARE_STEPS.md](DEPLOY_CLOUDFLARE_STEPS.md) per la guida completa.
