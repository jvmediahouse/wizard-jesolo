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
supabase functions deploy send-wizard-emails
supabase functions deploy manage-admins
```

> `manage-admins` serve al tab **Admin users** del pannello `/admin` (lista utenti, concessione/revoca del ruolo admin).

> I secret delle edge functions (es. `OPENAI_API_KEY`) si configurano nel dashboard Supabase sotto **Edge Functions → Secrets**. Non aggiungere mai questi valori come variabili `VITE_*` — sarebbero esposti nel bundle del frontend.


---

## 7. Ricrea il primo amministratore

`supabase db push` replica **solo lo schema**: gli utenti di `auth.users` e le righe di `public.user_roles` del vecchio progetto **non vengono copiati**. Sul nuovo progetto quindi nessuno può accedere a `/admin` finché non si ricrea almeno un admin. Dopo il primo, gli altri si gestiscono dal tab **Admin users** del pannello.

1. **Configura gli URL di redirect.** In **Authentication → URL Configuration** imposta **Site URL** sul dominio di produzione e aggiungi in **Redirect URLs** `https://<dominio>/admin` (e `http://localhost:8080/admin` per lo sviluppo). Senza questo, il link di conferma email punta all'URL sbagliato.
2. **Crea l'utente.** Hai due strade:
   - da **Authentication → Users → Add user → Create new user**, con email, password e **Auto Confirm User** spuntato (consigliato: non richiede l'invio di email);
   - oppure dal tab **Sign up** su `/auth`, confermando poi l'email. Lo SMTP di default di Supabase invia solo agli indirizzi dei membri del team del progetto e ha limiti molto bassi: per altri indirizzi serve uno SMTP personalizzato (**Authentication → Emails → SMTP Settings**).
3. **Assegna il ruolo admin** da **SQL Editor**:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE email = 'nome@dominio.it'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verifica
SELECT u.email, r.role
FROM public.user_roles r
JOIN auth.users u ON u.id = r.user_id;
```

4. Fai logout e login su `/auth`: verrai reindirizzato a `/admin` con accesso completo.
