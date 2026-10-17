type ChoiceGroupProps = {
  name: string;
  legend: string;
  options: readonly string[];
  required?: boolean;
  /** Opción marcada al abrir. */
  defaultValue?: string | null;
};

/** Grupo de opciones excluyentes con radios nativos: teclado y lector de pantalla sin JS extra. */
export function ChoiceGroup({ name, legend, options, required, defaultValue }: ChoiceGroupProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={option}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm has-checked:border-primary has-checked:bg-muted"
          >
            <input
              type="radio"
              name={name}
              value={option}
              required={required}
              defaultChecked={option === defaultValue}
              className="accent-primary"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  );
}