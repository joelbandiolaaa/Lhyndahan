import type { ComponentProps, ReactNode } from "react";

const control =
  "w-full rounded-xl bg-surface px-4 text-[17px] text-ink placeholder:text-muted/70 " +
  "border border-line outline-none focus-visible:outline-none transition-[border-color,box-shadow] duration-200 " +
  "focus:border-accent focus:shadow-[0_0_0_4px_rgba(215,15,100,0.16)] " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:focus:shadow-[0_0_0_4px_rgba(215,0,21,0.15)]";

type FieldProps = {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
};

export function Field({ label, name, error, hint, required, children }: FieldProps) {
  const id = `f-${name}`;
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-err` : null].filter(Boolean).join(" ");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[15px] font-medium text-ink">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </label>
      {children({ id, "aria-invalid": error ? true : undefined, "aria-describedby": describedBy || undefined })}
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function Input({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`${control} min-h-12 ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }: ComponentProps<"textarea">) {
  return <textarea className={`${control} min-h-28 py-3 ${className}`} {...props} />;
}

export function Select({ className = "", ...props }: ComponentProps<"select">) {
  return <select className={`${control} min-h-12 appearance-none ${className}`} {...props} />;
}

export function Toggle({
  name,
  checked,
  onChange,
  label,
  description,
}: {
  name: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-4">
      <span className="flex flex-col">
        <span className="text-[17px]">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
      <input
        type="checkbox"
        name={name}
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className="relative h-[31px] w-[51px] shrink-0 rounded-full bg-black/[0.12] transition-colors duration-200 peer-checked:bg-switch-on
                   peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent
                   after:absolute after:top-[2px] after:left-[2px] after:size-[27px] after:rounded-full after:bg-white
                   after:shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)]
                   after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
      />
    </label>
  );
}
