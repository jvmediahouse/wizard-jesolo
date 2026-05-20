import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Bot,
  Compass,
  MapPinned,
  MessageCircle,
  Minimize2,
  Sparkles,
  Waves,
  X,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const publishedBaseUrl = 'https://wizart-your-jesolo-guide.lovable.app';

const navItems = ['Home', 'About Jesolo', 'Things to do', 'Plan your stay', 'Assistant'];

const editorialSections = [
  {
    title: 'Spiagge e stabilimenti',
    description: 'Una pagina editoriale stile WordPress con callout, blocchi contenuto e accesso costante all’assistente.',
    icon: Waves,
  },
  {
    title: 'Eventi in evidenza',
    description: 'Il widget resta presente in ogni sezione, così il visitatore può chiedere suggerimenti senza lasciare la pagina.',
    icon: Sparkles,
  },
  {
    title: 'Itinerari e attività',
    description: 'La wrapper page mostra invece un’esperienza più immersiva, utile quando il partner vuole una pagina dedicata.',
    icon: Compass,
  },
];

const sponsorBenefits = [
  'Launcher fisso in basso a destra, coerente con un support chat.',
  'Esperienza responsive: pannello desktop e full-screen mobile.',
  'Pagina dedicata brandizzata, facile da collegare dal menu WordPress.',
];

function DemoIframe({ src, title, className }: { src: string; title: string; className?: string }) {
  return (
    <iframe
      src={src}
      title={title}
      loading="lazy"
      className={className}
      allow="clipboard-write"
    />
  );
}

export default function JesoloDemo() {
  const [widgetOpen, setWidgetOpen] = useState(false);
  const isMobile = useIsMobile();

  const widgetSrc = useMemo(() => `${publishedBaseUrl}/?embed=widget`, []);
  const pageSrc = useMemo(() => `${publishedBaseUrl}/?embed=page`, []);

  const WidgetFrame = (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted/60 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Bot className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Wizart Assistant</p>
            <p className="text-xs text-muted-foreground">Support chat embed preview</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWidgetOpen(false)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setWidgetOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <DemoIframe
        src={widgetSrc}
        title="Wizart widget demo"
        className="h-full min-h-0 w-full flex-1 border-0 bg-background"
      />
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <MapPinned className="h-5 w-5" />
            </div>
            <div>
              <p className="text-lg font-semibold text-foreground">Jesolo Demo</p>
              <p className="text-xs text-muted-foreground">WordPress-style embedding preview</p>
            </div>
          </div>
          <nav className="hidden items-center gap-6 md:flex">
            {navItems.map((item) => (
              <a key={item} href={item === 'Assistant' ? '#assistant-page' : '#content'} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                {item}
              </a>
            ))}
          </nav>
          <Button asChild variant="outline" size="sm">
            <Link to="/">Back to app</Link>
          </Button>
        </div>
      </header>

      <main>
        <section className="border-b border-border bg-muted/40">
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="space-y-6">
              <Badge variant="secondary" className="w-fit">Embedding concept</Badge>
              <div className="space-y-4">
                <h1 className="text-4xl font-bold text-foreground md:text-5xl">Wizart inside a WordPress-like Jesolo experience.</h1>
                <p className="max-w-2xl text-lg text-muted-foreground">
                  This demo shows both sponsor options: a persistent floating support chat and a branded assistant page.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => setWidgetOpen(true)}>
                  <MessageCircle className="h-4 w-4" />
                  Open floating chat
                </Button>
                <Button asChild variant="outline">
                  <a href="#assistant-page">
                    View wrapper page
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
              </div>
              <ul className="grid gap-3 sm:grid-cols-3">
                {sponsorBenefits.map((benefit) => (
                  <li key={benefit} className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-sm">
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>

            <Card className="overflow-hidden border-border bg-card">
              <CardHeader className="space-y-3 border-b border-border bg-muted/50">
                <CardTitle className="text-2xl text-foreground">Floating widget preview</CardTitle>
                <CardDescription>
                  A realistic launcher stays visible across the site and opens the published assistant in an iframe.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 p-6">
                <div className="rounded-lg border border-border bg-background p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground">Launcher state</p>
                    <Badge variant="outline">Always visible</Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-dashed border-border bg-muted/40 px-4 py-5">
                    <div>
                      <p className="text-sm font-semibold text-foreground">Need help planning Jesolo?</p>
                      <p className="text-xs text-muted-foreground">Widget opens the real published app in compact mode.</p>
                    </div>
                    <Button size="sm" onClick={() => setWidgetOpen(true)}>
                      <MessageCircle className="h-4 w-4" />
                      Launch
                    </Button>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {editorialSections.map(({ title, description, icon: Icon }) => (
                    <div key={title} className="rounded-lg border border-border bg-muted/30 p-4 sm:col-span-1 last:sm:col-span-2">
                      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
                        <Icon className="h-5 w-5" />
                      </div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        <section id="content" className="mx-auto max-w-7xl px-6 py-16">
          <div className="grid gap-6 lg:grid-cols-3">
            {editorialSections.map(({ title, description, icon: Icon }) => (
              <Card key={title} className="border-border bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl text-foreground">{title}</CardTitle>
                  <CardDescription>{description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        <section id="assistant-page" className="border-y border-border bg-muted/30">
          <div className="mx-auto grid max-w-7xl gap-8 px-6 py-16 lg:grid-cols-[0.78fr_1.22fr]">
            <div className="space-y-5">
              <Badge variant="secondary" className="w-fit">Wrapper page</Badge>
              <div className="space-y-3">
                <h2 className="text-3xl font-bold text-foreground">Dedicated assistant page for WordPress navigation.</h2>
                <p className="text-muted-foreground">
                  Ideal when the partner wants an editorial intro, SEO content, and a stable branded container around the assistant.
                </p>
              </div>
              <div className="space-y-3 rounded-lg border border-border bg-card p-5 shadow-sm">
                <p className="text-sm font-semibold text-foreground">Recommended WordPress placement</p>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Menu entry in the main navigation or utility bar.</li>
                  <li>• Intro paragraph explaining the assistant’s role.</li>
                  <li>• Iframe block with generous height and native page context.</li>
                </ul>
              </div>
            </div>
            <Card className="overflow-hidden border-border bg-card shadow-sm">
              <CardHeader className="border-b border-border bg-card/80">
                <CardTitle className="text-2xl text-foreground">Ask Wizart</CardTitle>
                <CardDescription>Published app embedded in page mode with cleaner spacing for content wrappers.</CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="overflow-hidden rounded-lg border border-border bg-background">
                  <DemoIframe
                    src={pageSrc}
                    title="Wizart wrapper demo"
                    className="h-[760px] w-full border-0 bg-background"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-card/95">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>Jesolo Demo — sponsor preview for WordPress embedding.</p>
          <div className="flex gap-4">
            <a href="#content" className="hover:text-foreground">Explore content</a>
            <a href="#assistant-page" className="hover:text-foreground">Assistant page</a>
          </div>
        </div>
      </footer>

      {isMobile ? (
        <Sheet open={widgetOpen} onOpenChange={setWidgetOpen}>
          <SheetContent side="bottom" className="h-[92vh] rounded-t-lg border-border p-0">
            {WidgetFrame}
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={widgetOpen} onOpenChange={setWidgetOpen}>
          <DialogContent className="left-auto right-6 top-auto max-w-[420px] translate-x-0 translate-y-0 gap-0 border-0 bg-transparent p-0 shadow-none data-[state=closed]:slide-out-to-bottom-4 data-[state=open]:slide-in-from-bottom-4 sm:rounded-none">
            <div className="h-[680px] w-[420px]">{WidgetFrame}</div>
          </DialogContent>
        </Dialog>
      )}

      {!widgetOpen && (
        <div className="fixed bottom-6 right-6 z-40 flex items-end justify-end">
          <Button size="lg" className="h-14 rounded-full px-5 shadow-lg" onClick={() => setWidgetOpen(true)}>
            <MessageCircle className="h-5 w-5" />
            Ask Wizart
          </Button>
        </div>
      )}
    </div>
  );
}