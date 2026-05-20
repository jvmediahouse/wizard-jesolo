import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const GATEWAY_URL = 'https://connector-gateway.lovable.dev/resend'
const FROM = 'Jesolo.it <wizard@jesolo.it>'
const ADMIN_EMAIL = 'marco.petrazzi@hooop.it'

type Lang = 'it' | 'en' | 'de'

const USER_COPY: Record<Lang, { subject: string; greeting: (n: string) => string; body: string; accommodation: string; infoPoint: string; signature: string }> = {
  it: {
    subject: 'Il tuo piano per Jesolo',
    greeting: (n) => n ? `Ciao ${n},` : 'Ciao,',
    body: 'grazie per aver usato il nostro assistente! In allegato trovi il piano personalizzato per la tua vacanza a Jesolo.',
    accommodation: 'Dove dormire a Jesolo',
    infoPoint: 'Info Point di Jesolo',
    signature: 'Buona vacanza,<br/>Il team di Jesolo.it',
  },
  en: {
    subject: 'Your Jesolo travel plan',
    greeting: (n) => n ? `Hi ${n},` : 'Hi,',
    body: 'thanks for using our assistant! Attached you will find your personalised plan for your holiday in Jesolo.',
    accommodation: 'Where to stay in Jesolo',
    infoPoint: 'Jesolo Info Point',
    signature: 'Enjoy your holiday,<br/>The Jesolo.it team',
  },
  de: {
    subject: 'Dein Urlaubsplan für Jesolo',
    greeting: (n) => n ? `Hallo ${n},` : 'Hallo,',
    body: 'danke, dass du unseren Assistenten genutzt hast! Im Anhang findest du deinen persönlichen Urlaubsplan für Jesolo.',
    accommodation: 'Unterkünfte in Jesolo',
    infoPoint: 'Jesolo Info Point',
    signature: 'Schönen Urlaub,<br/>Das Jesolo.it-Team',
  },
}

function urls(lang: Lang) {
  const prefix = lang === 'it' ? '' : `/${lang}`
  return {
    accommodation: `https://jesolo.it${prefix}/dove-dormire/`,
    infoPoint: `https://jesolo.it${prefix}/info-point/`,
  }
}

function escapeHtml(s: unknown): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
}

function userHtml(lang: Lang, name: string) {
  const c = USER_COPY[lang]
  const u = urls(lang)
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#ffffff;color:#1a1a1a;padding:24px;">
    <div style="max-width:560px;margin:0 auto;">
      <h2 style="color:#0c2340;margin:0 0 16px;">${escapeHtml(c.subject)}</h2>
      <p>${escapeHtml(c.greeting(name))}</p>
      <p>${escapeHtml(c.body)}</p>
      <p style="margin:24px 0;">
        <a href="${u.accommodation}" style="display:inline-block;background:#0c2340;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;margin-right:8px;">${escapeHtml(c.accommodation)}</a>
        <a href="${u.infoPoint}" style="display:inline-block;background:#c9a84c;color:#1a1a1a;padding:10px 18px;border-radius:6px;text-decoration:none;">${escapeHtml(c.infoPoint)}</a>
      </p>
      <p style="color:#666;font-size:13px;margin-top:32px;">${c.signature}</p>
    </div>
  </body></html>`
}

function adminHtml(userData: Record<string, unknown>, planTitle: string | null, lang: string) {
  const row = (k: string, v: unknown) => {
    const val = Array.isArray(v) ? v.join(', ') : (typeof v === 'boolean' ? (v ? 'Sì' : 'No') : (v ?? '—'))
    return `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee;color:#666;font-size:13px;white-space:nowrap;">${escapeHtml(k)}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;font-size:13px;">${escapeHtml(val)}</td></tr>`
  }
  const d = userData as any
  return `<!doctype html><html><body style="font-family:Arial,sans-serif;background:#fff;color:#1a1a1a;padding:24px;">
    <div style="max-width:640px;margin:0 auto;">
      <h2 style="color:#0c2340;margin:0 0 8px;">Nuovo lead Wizard Jesolo.it</h2>
      <p style="color:#666;font-size:13px;margin:0 0 16px;">${new Date().toLocaleString('it-IT', { timeZone: 'Europe/Rome' })} — lingua: ${escapeHtml(lang)}</p>
      ${planTitle ? `<p><strong>Piano:</strong> ${escapeHtml(planTitle)}</p>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-top:12px;">
        ${row('Nome', d.name)}
        ${row('Cognome', d.surname)}
        ${row('Email', d.email)}
        ${row('Città', d.city)}
        ${row('Provincia', d.province)}
        ${row('Paese', d.country)}
        ${row('Età', d.ageRange)}
        ${row('Percorso', d.path)}
        ${row('Gruppo', d.travelGroup)}
        ${row('Interessi', d.interests)}
        ${row('Spiaggia', d.beachPreference)}
        ${row('Sport', d.sports)}
        ${row('Eventi', d.eventTypes)}
        ${row('Lifestyle', d.lifestyle)}
        ${row('Data inizio', d.selectedDate)}
        ${row('Data fine', d.endDate)}
        ${row('Animale', d.hasPet)}
        ${row('Privacy', d.privacyConsent)}
        ${row('Newsletter', d.newsletter)}
      </table>
    </div>
  </body></html>`
}

async function sendEmail(payload: Record<string, unknown>) {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
  const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
  if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY missing')
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY missing')
  const res = await fetch(`${GATEWAY_URL}/emails`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${LOVABLE_API_KEY}`,
      'X-Connection-Api-Key': RESEND_API_KEY,
    },
    body: JSON.stringify(payload),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Resend ${res.status}: ${JSON.stringify(data)}`)
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const body = await req.json()
    const language = (body.language as string || 'it').split('-')[0].toLowerCase()
    const lang: Lang = (['it', 'en', 'de'].includes(language) ? language : 'it') as Lang
    const userData = (body.userData ?? {}) as Record<string, unknown>
    const recipientEmail = (userData.email as string) || ''
    const pdfBase64 = body.pdfBase64 as string | undefined
    const planTitle = (body.planTitle as string) || null
    const name = ((userData.name as string) || '').trim()

    const results: Record<string, unknown> = {}

    if (recipientEmail && pdfBase64) {
      const c = USER_COPY[lang]
      results.user = await sendEmail({
        from: FROM,
        to: [recipientEmail],
        subject: c.subject,
        html: userHtml(lang, name),
        attachments: [{ filename: 'jesolo-vacation-plan.pdf', content: pdfBase64 }],
      })
    }

    results.admin = await sendEmail({
      from: FROM,
      to: [ADMIN_EMAIL],
      subject: `Nuovo lead Wizard — ${name || 'anonimo'} ${(userData.surname as string) || ''}`.trim(),
      html: adminHtml(userData, planTitle, lang),
      reply_to: recipientEmail || undefined,
    })

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-wizard-emails error:', e)
    return new Response(JSON.stringify({ success: false, error: e instanceof Error ? e.message : 'Unknown' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})