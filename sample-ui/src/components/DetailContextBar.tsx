import type { ReactNode } from "react";

interface ContextSelectOption {
  value: string;
  label: string;
}

interface ContextSelectField {
  id: string;
  label: string;
  value: string;
  options: ContextSelectOption[];
  onChange: (value: string) => void;
}

interface DetailContextBarProps {
  eyebrow: string;
  title: string;
  description: string;
  fields: ContextSelectField[];
  actions?: ReactNode;
}

export function DetailContextBar({
  eyebrow,
  title,
  description,
  fields,
  actions
}: DetailContextBarProps) {
  return (
    <section className="surface context-switcher-surface">
      <div className="panel-heading">
        <div className="context-switcher-copy">
          <p className="eyebrow-label">{eyebrow}</p>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>

        {actions ? <div className="context-switcher-actions">{actions}</div> : null}
      </div>

      <div className="context-switcher-grid">
        {fields.map((field) => (
          <label key={field.id} className="context-switcher-field" htmlFor={field.id}>
            <span className="field-label">{field.label}</span>
            <select
              id={field.id}
              className="input"
              value={field.value}
              onChange={(event) => field.onChange(event.target.value)}
            >
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </section>
  );
}
