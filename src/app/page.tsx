import { Suspense } from "react";
import { getUser } from "@/lib/session";
import { PageContainer } from "@/components/ui/page-container";
import { PromptForm } from "@/components/prompt-form";
import { LandingBento } from "@/components/home/landing-bento";
import { LandingFaq } from "@/components/home/landing-faq";
import { LandingCta } from "@/components/home/landing-cta";

export default function Home() {
  return (
    <PageContainer size="lg" className="relative overflow-hidden">
      <div aria-hidden="true" className="hero-dots pointer-events-none absolute inset-0" />
      <div
        aria-hidden="true"
        className="hero-halo pointer-events-none absolute top-56 left-1/2 h-[460px] w-[820px] max-w-full -translate-x-1/2"
      />

      <div className="relative flex flex-col items-center gap-7 pt-10 pb-24 text-center sm:pt-20">
        <Suspense fallback={<Eyebrow>{DEFAULT_EYEBROW}</Eyebrow>}>
          <Greeting />
        </Suspense>

        <h1 className="rise text-5xl leading-[0.95] font-bold tracking-tighter [animation-delay:60ms] sm:text-7xl">
          ¿Qué <span className="mark-accent">negocio</span>
          <br className="hidden sm:block" /> quieres montar?
        </h1>
        <p className="rise max-w-xl text-lg text-muted-foreground [animation-delay:120ms]">
          Te decimos si es viable y cómo montarlo. Y siempre qué es seguro y qué no.
        </p>

        <div className="rise flex w-full justify-center [animation-delay:200ms]">
          {/* Mismo alto que la caja: la portada no salta mientras se lee la sesión. */}
          <Suspense fallback={<div aria-hidden="true" className="h-[236px] w-full max-w-2xl rounded-[1.25rem] bg-surface" />}>
            <HomeForm />
          </Suspense>
        </div>
      </div>

      <Suspense fallback={null}>
        <GuestSections />
      </Suspense>
    </PageContainer>
  );
}

const DEFAULT_EYEBROW = "Informe de viabilidad + plan paso a paso";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rise inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1 text-xs font-medium text-muted-foreground shadow-soft">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
      {children}
    </p>
  );
}

async function Greeting() {
  const user = await getUser();
  return <Eyebrow>{user ? `Hola, ${user.name}` : DEFAULT_EYEBROW}</Eyebrow>;
}

/** Lo que vende el producto: solo para quien aún no tiene cuenta. */
async function GuestSections() {
  const user = await getUser();
  if (user) return null;
  return (
    <>
      <LandingBento />
      <LandingFaq />
      <LandingCta />
    </>
  );
}

async function HomeForm() {
  const user = await getUser();
  return <PromptForm signedIn={user !== null} />;
}