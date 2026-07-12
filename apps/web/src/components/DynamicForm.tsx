import type { FormFieldDescriptor } from "@track-forge/genre-core";

export interface DynamicFormProps {
  fields: FormFieldDescriptor[];
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  /** Override options for specific fields (dynamic population) */
  fieldOptions?: Record<string, { label: string; value: string }[]>;
}

export function DynamicForm({ fields, values, onChange, fieldOptions }: DynamicFormProps) {
  return (
    <div class="form-grid">
      {fields.map((field) => {
        const val = values[field.key] ?? "";
        const options = fieldOptions?.[field.key] ?? field.options ?? [];
        const id = `field-${field.key}`;

        switch (field.type) {
          case "text":
            return (
              <div class="form-field" key={field.key}>
                <label htmlFor={id}>{field.label}</label>
                <input
                  id={id}
                  type="text"
                  value={String(val)}
                  onInput={(e) => onChange(field.key, (e.target as HTMLInputElement).value)}
                />
              </div>
            );

          case "number": {
            const min = (field.constraints?.min as number | undefined) ?? 0;
            const max = (field.constraints?.max as number | undefined) ?? 9999;
            return (
              <div class="form-field" key={field.key}>
                <label htmlFor={id}>{field.label}</label>
                <input
                  id={id}
                  type="number"
                  min={min}
                  max={max}
                  value={val === 0 ? 0 : String(val || "")}
                  onInput={(e) => {
                    const raw = (e.target as HTMLInputElement).value;
                    onChange(field.key, raw ? Number(raw) : "");
                  }}
                />
              </div>
            );
          }

          case "select":
            return (
              <div class="form-field" key={field.key}>
                <label htmlFor={id}>{field.label}</label>
                <select
                  id={id}
                  value={String(val)}
                  onChange={(e) => onChange(field.key, (e.target as HTMLSelectElement).value)}
                >
                  {options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            );

          case "multiselect": {
            const arr: string[] = Array.isArray(val) ? val : [];
            return (
              <div class="form-field" key={field.key}>
                <label>{field.label}</label>
                <div class="multiselect">
                  {options.map((opt) => {
                    const checked = arr.includes(opt.value);
                    return (
                      <label key={opt.value} class="multiselect-option">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            const next = checked
                              ? arr.filter((v) => v !== opt.value)
                              : [...arr, opt.value];
                            onChange(field.key, next);
                          }}
                        />
                        {opt.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          }

          case "toggle":
            return (
              <div class="form-field" key={field.key}>
                <label class="toggle-label">
                  <input
                    type="checkbox"
                    checked={Boolean(val)}
                    onChange={(e) =>
                      onChange(field.key, (e.target as HTMLInputElement).checked)
                    }
                  />
                  {field.label}
                </label>
              </div>
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

/** Textarea for longer text fields */
export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div class="form-field">
      <label>{label}</label>
      <textarea
        rows={3}
        value={value}
        onInput={(e) => onChange((e.target as HTMLTextAreaElement).value)}
      />
    </div>
  );
}

/** Simple status badge */
export function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "completed"
      ? "badge badge-ok"
      : status === "failed"
        ? "badge badge-err"
        : status === "in_progress"
          ? "badge badge-progress"
          : "badge badge-pending";
  return <span class={cls}>{status.replace(/_/g, " ")}</span>;
}

/** Stage indicator */
export function StageIndicator({ stage }: { stage: string }) {
  return <span class="stage">{stage.replace(/_/g, " ")}</span>;
}
