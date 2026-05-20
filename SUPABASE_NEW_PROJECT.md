# Guida: replicare lo schema su un nuovo progetto Supabase

---

## 1. Crea il nuovo progetto Supabase

Vai su [supabase.com](https://supabase.com), crea un nuovo progetto e annota:

- **Project URL** (es. `https://xxxxxxxxxxxx.supabase.co`)
- **anon key** e **service_role key** (da **Settings → API**)

---

## 2. Modifica il file `.env` con i nuovi valori

```env
VITE_SUPABASE_URL=https://<nuovo-project-id>.supabase.co
VITE_SUPABASE_PROJECT_ID=<nuovo-project-id>
VITE_SUPABASE_PUBLISHABLE_KEY=<nuova-anon-key>
```

---

## 3. Installa la Supabase CLI e collega il progetto locale al nuovo progetto remoto

Dalla root del tuo workspace:

```bash
supabase login
supabase link --project-ref <nuovo-project-ref>
```

> `<nuovo-project-ref>` è l'ID del database — lo stesso valore di `VITE_SUPABASE_PROJECT_ID`.

---

## 4. Aggiorna la migration del cron job con i dati del nuovo progetto

Il file `supabase/migrations/20260417133700_82f06b28-eb54-4533-bf28-62039aee28db.sql` contiene un cron job che chiama la edge function `sync-jesolo-data` via HTTP. L'URL e il Bearer token sono hardcoded con i valori del progetto originale — **devono essere aggiornati prima di eseguire `db push`**.

Apri il file e sostituisci:

| Cosa | Valore originale da sostituire | Nuovo valore (dal tuo `.env`) |
|---|---|---|
| Project ID nell'URL | `ikjsfzgahlncfnjtqfem` | valore di `VITE_SUPABASE_PROJECT_ID` |
| Bearer token | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlranNmemdhaGxuY2ZuanRxZmVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzIyODYsImV4cCI6MjA5MjAwODI4Nn0.lESjRAEFuJ6Tjuz1r98De3O6cbmuWlkteZtYolJpvGo` | valore di `VITE_SUPABASE_PUBLISHABLE_KEY` |

La riga da modificare si trova all'interno di `cron.schedule(...)`:

```sql
-- Prima (originale)
url := 'https://ikjsfzgahlncfnjtqfem.supabase.co/functions/v1/sync-jesolo-data',
headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."}'::jsonb,

-- Dopo (con i tuoi dati)
url := 'https://<VITE_SUPABASE_PROJECT_ID>.supabase.co/functions/v1/sync-jesolo-data',
headers := '{"Content-Type":"application/json","Authorization":"Bearer <VITE_SUPABASE_PUBLISHABLE_KEY>"}'::jsonb,
```

> ⚠️ Se esegui `db push` senza aggiornare questo file, il cron job punterà al progetto Supabase sbagliato e la sincronizzazione giornaliera dei dati Jesolo non funzionerà.

---

## 5. Esegui le migration in ordine

Le migration sono numerate per timestamp, quindi vengono applicate nell'ordine corretto:

```bash
supabase db push
```

Questo applica tutte le migration nella cartella `migrations/` che non sono ancora state applicate al database remoto.

In alternativa, se vuoi controllare ogni step prima di eseguirlo:

```bash
supabase db push --dry-run   # mostra cosa verrà eseguito senza farlo
```

Dopo il push, vai su **Table Editor** e **Database → Indexes / Triggers / Functions** per verificare che ci siano:

- **19 tabelle**
- **30 indici** (19 PK + 2 UNIQUE + 9 espliciti)
- **8 trigger**
- **2 functions**

Verifica anche su Supabase in **Database → Extensions** che le estensioni **`pg_cron`** e **`pg_net`** siano attive.

---

## 6. Deploy delle Edge Functions

Le Edge Functions (`generate-vacation-plan`, `sync-jesolo-data`) vanno deployate separatamente e costituiscono il backend dell'applicazione:

```bash
supabase functions deploy generate-vacation-plan
supabase functions deploy sync-jesolo-data
```

> I secret delle edge functions (es. `OPENAI_API_KEY`) si configurano nel dashboard Supabase sotto **Edge Functions → Secrets**. Non aggiungere mai questi valori come variabili `VITE_*` — sarebbero esposti nel bundle del frontend.
