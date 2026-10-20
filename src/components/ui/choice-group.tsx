import { NOT_DECIDED } from "@/lib/report/certainty";
import { cn } from "@/lib/cn";

type ChoiceGroupProps = {
  name: string;
  legend: string;
  options: readonly string[];
  required?: boolean;
  /** Opción marcada al abrir. */
  defaultValue?: string | null;
};

/**
 * Grupo de opciones excluyentes con radios nativos (teclado y lector de pantalla sin JS extra).
 * Las columnas dependen del hueco disponible (container queries), no de la pantalla.
 * "Not decided yet" va aparte: no saber es una respuesta válida, pero no una opción más.
 */
export function ChoiceGroup({ name, legend, options, required, defaultValue }: ChoiceGroupProps) {
  const main = options.filter((option) => option !== NOT_DECIDED);
  const undecided = options.includes(NOT_DECIDED);
  const choice = (option: string, isUndecided: boolean) => (
    <Choice
      key={option}
      name={name}
      option={option}
      required={required}
      checked={option === defaultValue}
      undecided={isUndecided}
    />
  );

  return (
    <fieldset className="@container flex flex-col gap-3">
      <legend className="mb-3 text-base font-semibold">{legend}</legend>
      <div className="grid grid-cols-1 gap-2 @xs:grid-cols-2 @lg:grid-cols-3">{main.map((option) => choice(option, false))}</div>
      {undecided && choice(NOT_DECIDED, true)}
    </fieldset>
  );
}

function Choice({
  name,
  option,
  required,
  checked,
  undecided,
}: {
  name: string;
  option: string;
  required?: boolean;
  checked: boolean;
  undecided: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-12 cursor-pointer items-center gap-3 px-4 text-sm transition-colors has-focus-visible:ring-2 has-focus-visible:ring-ring",
        undecided
          ? "self-start rounded-full border border-dashed border-muted-foreground text-muted-foreground hover:text-foreground has-checked:border-solid has-checked:border-accent has-checked:text-foreground"
          : "rounded-[0.75rem] border bg-background hover:border-muted-foreground has-checked:border-accent has-checked:bg-accent/10 has-checked:font-medium",
      )}
    >
      <input
        type="radio"
        name={name}
        value={option}
        required={required}
        defaultChecked={checked}
        // Círculo propio; el foco se ve en toda la baldosa (has-focus-visible del label).
        className="size-4 shrink-0 appearance-none rounded-full border-2 border-input transition-colors checked:border-accent checked:bg-accent checked:shadow-[inset_0_0_0_3px_var(--color-background)] focus-visible:outline-none"
      />
      {option}
    </label>
  );
}