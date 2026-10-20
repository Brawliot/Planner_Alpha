import { VerdictIcon, VerdictLabel } from "@/components/ui/verdict-icon";
import type { Verdict } from "@/lib/report/verdict";
import { cn } from "@/lib/cn";

/** Sección de la portada para quien aún no tiene cuenta. Todo es un ejemplo marcado como tal. */
export function LandingBento() {
  return (
    <section aria-labelledby="bento-title" className="rounded-[1.5rem] bg-surface px-6 py-16 sm:px-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <h2 id="bento-title" className="text-4xl font-bold tracking-tighter sm:text-5xl">
          De idea a plan, <span className="mark-accent">sin humo</span>
        </h2>
        <p className="max-w-xl text-muted-foreground">Un informe honesto y un plan con fechas, costes y el siguiente paso.</p>
      </div>

      <div className="mt-10 grid gap-4 md:auto-rows-[minmax(150px,auto)] md:grid-cols-6">
        <Card className="justify-between gap-6 md:col-span-2">
          <StepNumber>1</StepNumber>
          <div>
            <h3 className="text-lg font-semibold">Cuéntanos tu idea</h3>
            <p className="text-sm text-muted-foreground">Con tus palabras, sin formularios largos.</p>
          </div>
        </Card>

        <Card className="gap-4 md:col-span-4 md:row-span-2">
          <CardHeader title="Informe de viabilidad" />
          <ul className="flex flex-col gap-2">
            <Area verdict="strong" area="Mercado" label="A favor" />
            <Area verdict="risk" area="Costes" label="A trabajar">
              <p className="flex flex-wrap items-baseline gap-x-2 px-3.5 pb-3 pl-[48px] text-sm">
                <span className="text-muted-foreground">Alquiler:</span>
                <span>1.200 €/mes</span>
                <EstimatedTag />
              </p>
            </Area>
            <Area verdict="needs_info" area="Licencias" label="Falta información" />
          </ul>
        </Card>

        <Card className="justify-between gap-6 md:col-span-2">
          <StepNumber>2</StepNumber>
          <div>
            <h3 className="text-lg font-semibold">Responde unas preguntas</h3>
            <p className="text-sm text-muted-foreground">¿No lo sabes? Dilo: queda como pendiente.</p>
          </div>
        </Card>

        {/* Tarjeta invertida: el momento de contraste de la sección. */}
        <Card className="gap-5 bg-foreground text-background md:col-span-3">
          <h3 className="text-2xl font-bold tracking-tight">Siempre sabrás qué es seguro y qué no.</h3>
          <ul className="flex flex-col gap-3 text-sm">
            <li className="flex items-center gap-3">
              <span className="rounded-full bg-accent px-2 text-xs font-semibold text-accent-foreground">sabido</span>
              Lo que nos has contado.
            </li>
            <li className="flex items-center gap-3">
              <span className="rounded-full border border-dashed border-current px-2 text-xs">estimado</span>
              Calculado, con sus supuestos a la vista.
            </li>
            <li className="flex items-center gap-3">
              <span className="rounded-full border border-current px-2 text-xs">por concretar</span>
              Lo que falta, sin inventarlo.
            </li>
          </ul>
          <p className="mt-auto text-xs">La IA redacta y clasifica. Las cifras y fechas las calcula el código.</p>
        </Card>

        <Card className="gap-4 md:col-span-3">
          <div className="flex items-center gap-3">
            <StepNumber>3</StepNumber>
            <h3 className="flex-1 text-lg font-semibold">Tu plan, empezando por hoy</h3>
            <ExampleTag />
          </div>
          <p className="flex flex-wrap items-baseline gap-2 text-sm">
            Apertura: semanas 8–12 <EstimatedTag />
          </p>
          <ol className="flex flex-col gap-2 text-sm">
            <li className="flex items-center justify-between gap-2 rounded-lg bg-surface px-3 py-2">
              <span>
                <span className="block font-medium">Validar la demanda</span>
                <span className="text-muted-foreground">Encuesta a 30 vecinos</span>
              </span>
              {/* Decorativo: en el ejemplo no se puede pulsar. */}
              <span aria-hidden="true" className="rounded-full bg-background px-3 py-1.5 text-xs font-medium shadow-soft">
                Hecho
              </span>
            </li>
            <li className="rounded-lg bg-surface px-3 py-2">
              <span className="block font-medium">Pedir presupuestos</span>
              <span className="text-muted-foreground">Esperando a: proveedor</span>
            </li>
          </ol>
        </Card>
      </div>
    </section>
  );
}

function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-[1.25rem] bg-background p-6 shadow-soft transition-transform duration-200 hover:-translate-y-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StepNumber({ children }: { children: React.ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-accent-foreground"
    >
      {children}
    </span>
  );
}

function CardHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h3 className="text-lg font-semibold">{title}</h3>
      <ExampleTag />
    </div>
  );
}

function ExampleTag() {
  return (
    <span className="rounded-full border border-dashed border-muted-foreground px-2 text-xs text-muted-foreground">Ejemplo</span>
  );
}

function EstimatedTag() {
  return (
    <span className="rounded-full border border-dashed border-muted-foreground px-2 text-xs text-muted-foreground">estimado</span>
  );
}

function Area({
  verdict,
  area,
  label,
  children,
}: {
  verdict: Verdict;
  area: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <li className="rounded-lg bg-surface">
      <p className="flex min-h-[52px] items-center gap-2.5 px-3.5 py-2.5 font-semibold">
        <VerdictIcon verdict={verdict} />
        <span className="flex-1">{area}</span>
        <VerdictLabel verdict={verdict}>{label}</VerdictLabel>
      </p>
      {children}
    </li>
  );
}