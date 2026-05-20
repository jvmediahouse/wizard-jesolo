# Wizart — Documentazione Tecnica

Wizart è un assistente conversazionale autonomo per il portale turistico [jesolo.it](https://www.jesolo.it). Guida i visitatori attraverso un breve wizard mobile-first a bolle di chat e produce o un elenco di eventi locali rilevanti o un piano vacanza completamente personalizzato e generato da AI (con PDF scaricabile).

- **Stack:** React 18 + Vite 5 + TypeScript 5 + Tailwind CSS v3 + shadcn/ui
- **i18n:** i18next (italiano principale, inglese, tedesco)
- **Backend:** Supabase (Postgres + RLS + Edge Function su Deno)
- **AI:** OpenAI Chat Completions (function calling) tramite la edge function `generate-vacation-plan`
- **Stato:** strettamente in-memory tramite React state — **nessun `localStorage`** per il wizard, così ogni accesso inizia una sessione pulita

---

## 1. Frontend

### 1.1 Entry point e routing

- `src/main.tsx` — fa il bootstrap di React, monta `<App />`, carica `src/i18n/index.ts`.
- `src/App.tsx` — incapsula l'app in `QueryClientProvider`, `TooltipProvider`, `Toaster`/`Sonner` e un `BrowserRouter`. Rotte:
  - `/` → `src/pages/Index.tsx` (il wizard)
  - `/auth` → `src/pages/Auth.tsx` (login/signup admin — chiunque può registrarsi, poi un admin deve concedere il ruolo)
  - `/admin` → `src/pages/Admin.tsx` (dashboard admin con due tab: **Submissions** e **Admin users**; protetta da `useAuth` + `has_role`)
  - `/jesolo-demo` → `src/pages/JesoloDemo.tsx` (demo di embed nella pagina ospitante)
  - `*` → `src/pages/NotFound.tsx`
- `src/hooks/useEmbedMode.ts` — rileva `?embed=1` (e simili) così il wizard può essere renderizzato in modalità iframe senza la chrome circostante.

### 1.2 Macchina a stati del wizard — `src/hooks/useWizard.ts`

L'intero flusso conversazionale è una macchina a stati finita guidata da un singolo valore `step: WizardStep`. Esistono due percorsi utente principali:

- `path = 'events'` — ricerca rapida degli eventi imminenti per un intervallo di date.
- `path = 'plan'` — piano vacanza personalizzato completo.

Valori di `WizardStep`:

```
welcome
events-date → events-results
plan-date → plan-group → plan-pet → plan-interests
         → data-beach → data-sports → data-event-type
         → data-lifestyle → data-age → data-name → data-city
         → lead-capture → results → complete
```

Componenti chiave:

- `userData: UserData` — accumula tutto ciò che l'utente fornisce (nome, email, città/provincia/paese, età, gruppo di viaggio, interessi, preferenza spiaggia, sport, tipi di eventi, **lifestyle** (food/shopping/wellness), intervallo di date, percorso, `hasPet`, consenso, newsletter).
- `goTo(next)` / `goBack()` — push/pop su uno stack `history` così il pulsante indietro ripristina lo step precedente senza perdere dati.
- `updateData(partial)` — fa il merge degli aggiornamenti parziali in `userData`.
- `reset()` — riporta tutto a `initialUserData` e `welcome`. Chiamato all'ingresso/riavvio così non ci sono perdite di sessione tra utenti.
- `progress` — barra 0–100 % derivata, guidata da una mappa step→bucket su `TOTAL_STEPS = 8`.

### 1.3 Schermate — `src/components/wizard/*`

Ogni schermata è un componente in stile chat costruito con `ChatBubble` + `OptionButton`. L'utente può procedere solo tramite pulsanti guidati (nessun input libero nel flusso di selezione del percorso); l'input libero è limitato a nome, email e città.

| Schermata | Scopo |
| --- | --- |
| `WelcomeScreen` | Saluto + scelta del percorso (`events` vs `plan`). |
| `EventsScreen` | Sceglie una data / intervallo, poi mostra gli eventi corrispondenti da `deskline_events` + `deskline_event_occurrences`. Il link di ogni evento include il prefisso lingua (`/it/`, `/en/`, `/de/`). Non c'è un pulsante "Continua" — l'utente esplora i link esterni e chiude la finestra o torna al percorso principale. |
| `PlanDateScreen` | Selettore di intervallo date per la vacanza. |
| `PlanGroupScreen` | Gruppo di viaggio (solo, coppia, famiglia con bambini, amici, …). |
| `PlanPetScreen` | Condizionale — solo per gruppi in cui gli animali sono plausibili. Imposta `hasPet`. |
| `PlanInterestsScreen` | Multi-select dei 7 interessi: Sport e outdoor, Relax e mare, Cultura ed eventi, Nightlife e divertimento, Bleisure (solo per viaggiatori singoli), Lifestyle, Gite & Territorio. È l'unico step che mantiene l'icona, come da memoria di design. |
| `DataCollectionScreen` | Schermate condizionali in cascata: preferenza spiaggia, **sport** (cicloturismo, outdoor, acquatici, golf, fitness indoor, karting), **tipi di evento** (sagre e folclore, concerti e spettacoli, eventi sportivi, eventi culturali), **lifestyle** (enogastronomia, shopping, wellness), fascia d'età, nome, città. |
| `LeadCaptureScreen` | Email + consenso privacy + opt-in newsletter; invia a `wizard_submissions`, poi triggera la edge function. |
| `ResultsScreen` | Schermata finale che mostra il piano AI tramite `PlanPreview`, più una CTA "Scarica PDF" e link in uscita verso jesolo.it. |
| `WizardHeader` | Barra di progresso + pulsante indietro + selettore lingua. |

### 1.4 i18n — `src/i18n/`

- `src/i18n/index.ts` inizializza `i18next` con tre bundle di risorse in `src/i18n/locales/{it,en,de}.json`.
- L'italiano è la lingua principale; inglese e tedesco devono restare sincronizzati per ogni nuova chiave.
- Il selettore di lingua vive in `WizardHeader`.

### 1.5 Generazione PDF — `src/lib/pdfGenerator.ts`

Generato lato client a partire dallo stesso JSON del piano restituito dalla edge function. Produce un itinerario brandizzato in tema mediterraneo che l'utente può scaricare da `ResultsScreen`. Nessun round-trip server — il piano AI è l'unica fonte di verità.

Dettagli di rendering:
- L'intestazione di ogni giorno usa una data localizzata leggibile (es. "Lunedì 1 giugno 2026 — Titolo"), formattata via `Intl.DateTimeFormat`.
- Sotto agli slot di ogni giornata viene stampato un blocco "Eventi consigliati" con titolo in grassetto, riga meta (orario + luogo, con orario "00:00" sostituito da "Tutto il giorno") e URL cliccabile in blu brand via `doc.textWithLink`.
- Il paragrafo "Introduzione" del piano è mostrato solo nella `PlanPreview` a schermo, **non** nel PDF, per mantenere il documento più compatto.

### 1.6 Area admin

- `src/hooks/useAuth.ts` — incapsula Supabase auth; espone `user`, `loading`, `isAdmin`, `signOut`. Verifica il ruolo `admin` tramite la funzione `has_role()`.
- `src/pages/Auth.tsx` — login/signup email/password con tab per Login e Sign up. Chiunque può creare un account, ma non accede a `/admin` senza il ruolo admin.
- `src/pages/Admin.tsx` — dashboard con due tab (`Tabs` di shadcn):
  1. **Submissions** → `src/components/admin/SubmissionsTable.tsx` + `SubmissionDetailDialog.tsx` — elencano e ispezionano le righe di `wizard_submissions`, incluso il JSON `generated_plan` salvato.
  2. **Admin users** → `src/components/admin/AdminUsersPanel.tsx` — lista **tutti** gli utenti registrati (`auth.users`) con:
     - `Grant admin` / `Revoke admin` — attiva/disattiva il ruolo nella tabella `user_roles`.
     - `Delete user` — elimina l'account da `auth.users` (cascata su `user_roles`).
     - Il proprio utente loggato mostra "(you)" e i pulsanti sono disabilitati (nessun auto-revoca o auto-cancellazione).
     - Confirm dialog (`window.confirm`) prima di revoke e delete.
- `src/components/admin/AdminUsersPanel.tsx` — chiama la edge function `manage-admins` per list/grant/revoke/delete.

### 1.7 Design system

- Token definiti in `src/index.css` e `tailwind.config.ts` (solo HSL). Palette mediterranea: blu oceano + oro sabbia.
- Mobile-first; bolle di chat, spaziatura generosa, tap target maggiorati.
- I componenti devono consumare token semantici (`bg-primary`, `text-foreground`, …) — mai colori grezzi.

---

## 2. Backend (Supabase)

### 2.1 Panoramica dello schema

**Contenuti (sincronizzati da jesolo.it / Deskline, lettura pubblica):**

- `activities`, `activity_categories`, `activity_to_category`
- `sports_facilities`, `sports_facility_categories`, `sports_facility_to_category`
- `bike_routes`
- `beach_establishments`
- `events`, `event_categories`, `categories`, `venues`
- `deskline_events`, `deskline_event_occurrences`, `deskline_themes`, `deskline_event_themes`
- `sync_log` — registro della edge function di sync.

**Generati dall'utente:**

- `wizard_submissions` — una riga per ogni esecuzione completata del wizard. Memorizza tutti i campi raccolti più il piano generato dall'AI come `jsonb`.

**Auth e ruoli:**

- enum `app_role` (`admin`, `moderator`, `user`)
- `user_roles (user_id, role)` — i ruoli sono tenuti **fuori** da qualsiasi tabella profilo per prevenire escalation di privilegi.
- `public.has_role(_user_id uuid, _role app_role)` — `SECURITY DEFINER`, usata dalle policy RLS per evitare ricorsioni.

### 2.2 Configurazione RLS

- Tutte le tabelle di contenuti: policy `Public read` (`USING true`), nessun accesso in scrittura dai client.
- `wizard_submissions`:
  - `INSERT` consentito ad `anon` + `authenticated` (chiunque può inviare).
  - `SELECT` / `DELETE` ristretti a `has_role(auth.uid(), 'admin')`.
  - Nessun `UPDATE` lato client — la riga è immutabile dopo la scrittura.
- `user_roles`: gestione solo admin; gli utenti possono leggere i propri ruoli.
- `sync_log`: nessuna policy; solo il service role (edge function) scrive qui.

### 2.3 Edge function — `supabase/functions/generate-vacation-plan/index.ts`

Il "travel agent" AI. Costruisce un itinerario personalizzato giorno per giorno a Jesolo a partire dalle risposte del wizard, usando **solo** eventi/attività reali presi dal database — mai venue, ristoranti o nomi inventati.

**Input (POST JSON):**
```ts
{ userData: UserData, language?: "it" | "en" | "de" }
```

**Pipeline:**
1. Parse dell'intervallo di date (`selectedDate` → `endDate`, default oggi).
2. Esegue query **in parallelo** su:
   - `deskline_events` nell'intervallo
   - `deskline_event_occurrences` nell'intervallo (eventi ricorrenti)
   - `activities`, `sports_facilities`, `bike_routes`, `beach_establishments`
   - `deskline_themes` (ordinati)
3. Recupera i temi per tutti gli eventi referenziati con una singola query di follow-up, ordinati per `order`.
4. Fa il merge degli eventi: preferisce le occorrenze datate, poi aggiunge gli eventi base unici.
5. Costruisce un oggetto `context` strutturato (preferenze + date + temi + eventi + attività + restrizioni) e lo passa a OpenAI.
6. Chiama OpenAI Chat Completions con un **tool call** forzato (`vacation_plan`) il cui schema vincola l'output:
   - `title`, `introduction` e `days[]`
   - Ogni giorno ha `date`, `title` e `slots[]` (`morning` / `afternoon` / `evening` / `full-day`).
   - `events[]` opzionale per giorno con `title`, `time`, `location`, `url` e `image` (thumbnail copiata verbatim dall'evento sorgente). Se l'orario è `00:00` o assente, il campo `time` viene omesso e la UI mostra "Tutto il giorno".
7. Restituisce `{ plan }`.

**Regole rigide cablate nel system prompt:**
- La lingua di output deve corrispondere a `language`.
- **Mai** raccomandare un ristorante, pizzeria, gelateria, hotel, B&B o struttura ricettiva con nome. Solo categorie generiche ("una trattoria di pesce sul lungomare", …).
- Coprire **ogni giorno** dell'intervallo, in ordine.
- Rispettare `local_restrictions.forbidden_suggestions` (es. niente bici in spiaggia, niente cani che fanno il bagno in mare) — non negoziabile.
- Composizione degli slot: 2–3 slot/giorno, OPPURE esattamente uno slot `full-day`, OPPURE un giorno leggero da 1–2 slot dopo attività impegnative.
- Non ripetere lo stesso evento nominato due volte; le attività generiche di spiaggia possono ripetersi con frasi variate.

**Glossario degli interessi** (chiavi di `userData.interests` interpretate dal prompt):
- `sport` — sport e outdoor; se valorizzato, `userData.sports[]` (cicloturismo, outdoor, acquatici, golf, fitness indoor, karting) guida le sotto-categorie.
- `relax` — spiaggia e relax; `userData.beachPreference` orienta verso spiaggia attrezzata o libera.
- `culture` — eventi culturali; `userData.eventTypes[]` (sagre/folclore, concerti, sportivi, culturali) pesa i suggerimenti.
- `nightlife` — bar, locali, aperitivi e serate sul lungomare.
- `bleisure` — solo per viaggiatori singoli: mattine tranquille e spot coworking-friendly, leisure al pomeriggio.
- `lifestyle` — enogastronomia, shopping e wellness/spa; se valorizzato, `userData.lifestyle[]` (food, shopping, wellness) guida le sotto-categorie (sempre senza nominare ristoranti o hotel).
- `trips` — escursioni e gite di mezza/intera giornata fuori Jesolo: Venezia, Burano, Murano, Treviso, Caorle, laguna ed entroterra. Quando la vacanza è abbastanza lunga viene inserita almeno una gita.

**Secret usati (`Deno.env`):**
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — accesso DB lato server.
- `OPENAI_API_KEY` — chiamate OpenAI.

`supabase/config.toml` imposta `verify_jwt = false` così la funzione è invocabile dal wizard senza un utente autenticato.

### 2.4 Edge function — `supabase/functions/sync-jesolo-data/index.ts`

Importa contenuti aggiornati dalle sorgenti di jesolo.it nelle tabelle `activities`, `sports_facilities`, `bike_routes`, `beach_establishments`, `events`/`venues` e `deskline_*`. Ogni esecuzione scrive una riga in `sync_log` (`source`, `status`, `records_synced`, `error`, timestamp). `verify_jwt = false` così può essere triggerata da uno scheduler.

### 2.5 Edge function — `supabase/functions/manage-admins/index.ts`

Gestione degli utenti admin da parte di utenti già admin. `verify_jwt = true` così viene invocata solo da client autenticati e valida il JWT in ingresso.

**Azioni (POST JSON con `action`):**
- `list` — restituisce **tutti** gli utenti registrati (`auth.admin.listUsers` paginato), uniti con `user_roles` per indicare chi è admin (`is_admin: true/false`). Ordinati per email.
- `grant` — inserisce `(user_id, 'admin')` in `user_roles`. Ignora duplicati silenziosamente.
- `revoke` — elimina la riga `(user_id, 'admin')`. Blocca il self-revoke.
- `delete` — chiama `auth.admin.deleteUser(user_id)`. Blocca l'auto-cancellazione.

Prima di ogni azione la funzione verifica che il chiamante abbia il ruolo `admin` tramite `has_role(callerId, 'admin')`.

---

## 3. Flusso end-to-end

1. L'utente apre `/`. `useWizard` resetta lo stato — niente `localStorage`, quindi è sempre una sessione pulita.
2. L'utente sceglie un percorso su `WelcomeScreen`.
3. **Percorso eventi** — la data viene raccolta, `EventsScreen` interroga direttamente `deskline_events` + `deskline_event_occurrences` con il client anonimo Supabase e mostra i risultati. I link agli eventi includono il prefisso lingua (`/it/`, `/en/`, `/de/`).
4. **Percorso piano** — il wizard raccoglie intervallo date → gruppo (+ pet opzionale) → interessi → spiaggia/sport/tipi di evento → età → nome/città → email + consenso.
5. `LeadCaptureScreen` esegue una `INSERT` su `wizard_submissions` (consentita dalla RLS a chiunque).
6. Il wizard chiama `supabase.functions.invoke('generate-vacation-plan', { body: { userData, language } })`.
7. La edge function costruisce il contesto, chiama OpenAI e restituisce il piano strutturato.
8. Il piano viene salvato sulla riga della submission (per la review admin) e renderizzato da `ResultsScreen` / `PlanPreview`.
9. L'utente può scaricare un PDF brandizzato (`pdfGenerator.ts`) o seguire le CTA verso jesolo.it.
10. Gli admin possono poi loggarsi su `/auth` e rivedere ogni submission su `/admin` → tab **Submissions**.
11. Un admin può aprire la tab **Admin users** per vedere tutti gli utenti registrati e concedere/revocare il ruolo admin o eliminare utenti.

---

## 4. Note operative

- **Crawler:** `public/robots.txt` attualmente vieta tutti gli user agent (`User-agent: * / Disallow: /`) — l'app non viene volutamente indicizzata.
- **Niente PII nei log:** la edge function logga il contesto a chunk per debug; evitare di aggiungere nuovi campi con dati sensibili senza sanificazione.
- **Sessioni pulite:** mai persistere lo stato del wizard in `localStorage` o cookie. Qualsiasi nuova persistenza deve essere opt-in e cancellata esplicitamente all'ingresso.
- **Traduzioni:** ogni nuova stringa del wizard deve essere aggiunta contemporaneamente a tutti e tre i file di locale (`it.json`, `en.json`, `de.json`).
- **Ruoli:** mai memorizzare i ruoli su una tabella profili/utenti — passare sempre da `user_roles` + `has_role()`.
