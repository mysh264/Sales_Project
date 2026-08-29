import type { ReactNode } from "react";

export function Field({
  label,
  children,
  className = "",
  hint,
}: {
  label?: ReactNode;
  children: ReactNode;
  className?: string;
  hint?: ReactNode;
}) {
  return (
    <label className={`ui-field ${className}`}>
      {label ? <span className="ui-label">{label}</span> : null}
      {children}
      {hint ? <span className="mt-1 block text-xs font-semibold text-slate-400">{hint}</span> : null}
    </label>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const { className = "", ...rest } = props;
  return <input className={`ui-input ${className}`} {...rest} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const { className = "", ...rest } = props;
  return <select className={`ui-input ${className}`} {...rest} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return <textarea className={`ui-input h-28 py-3 ${className}`} {...rest} />;
}
