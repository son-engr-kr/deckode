// Shared field components for theme and property panels

export function ColorField({
  label,
  value,
  onChange,
  mixed,
  inherited,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  mixed?: boolean;
  inherited?: boolean;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs flex-1">{label}</span>
      {mixed ? (
        <div
          className="w-7 h-7 rounded border border-zinc-700 bg-zinc-800"
          style={{
            backgroundImage:
              "repeating-linear-gradient(45deg, #52525b 0px, #52525b 4px, #3f3f46 4px, #3f3f46 8px)",
          }}
          title="Mixed values"
        />
      ) : (
        <input
          type="color"
          value={value ?? "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className={`w-7 h-7 rounded border bg-zinc-800 cursor-pointer ${
            inherited ? "border-dashed border-zinc-600" : "border-zinc-700"
          }`}
        />
      )}
      <span className={`text-xs font-mono text-right ${
        mixed ? "text-zinc-500 w-16"
          : inherited ? "text-zinc-600 italic w-24"
          : "text-zinc-500 w-16"
      }`}>
        {mixed ? "mixed" : inherited ? `${value ?? "\u2014"} (theme)` : value ?? "\u2014"}
      </span>
    </label>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  min,
  max,
  step,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs flex-1">{label}</span>
      <input
        type="number"
        value={value ?? ""}
        placeholder="\u2014"
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const num = parseFloat(e.target.value);
          if (!isNaN(num)) onChange(num);
        }}
        className="w-20 bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T | undefined;
  options: readonly T[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs flex-1">{label}</span>
      <select
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className="w-28 bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs border border-zinc-700 focus:border-blue-500 focus:outline-none"
      >
        <option value="">{"\u2014"}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  );
}

export function CheckboxField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs flex-1">{label}</span>
      <input
        type="checkbox"
        checked={value ?? false}
        onChange={(e) => onChange(e.target.checked)}
        className="rounded border-zinc-600"
      />
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-zinc-400 text-xs flex-1">{label}</span>
      <input
        type="text"
        value={value ?? ""}
        placeholder={placeholder ?? "\u2014"}
        onChange={(e) => onChange(e.target.value)}
        className="w-28 bg-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs font-mono border border-zinc-700 focus:border-blue-500 focus:outline-none"
      />
    </label>
  );
}

// -- Shared option constants --

export const CODE_THEMES = [
  "github-dark",
  "github-light",
  "dracula",
  "monokai",
  "nord",
  "one-dark-pro",
  "vitesse-dark",
  "vitesse-light",
  "min-dark",
  "min-light",
] as const;

export const OBJECT_FIT_OPTIONS = ["contain", "cover", "fill"] as const;
export const TEXT_ALIGN_OPTIONS = ["left", "center", "right"] as const;
export const VERTICAL_ALIGN_OPTIONS = ["top", "middle", "bottom"] as const;
export const TEXT_SIZING_OPTIONS = ["flexible", "fixed"] as const;
