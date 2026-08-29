import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="ui-pagehead">
      <div className="animate-fade-in">
        {eyebrow ? <p className="ui-pagehead-eyebrow">{eyebrow}</p> : null}
        <h1 className="ui-pagehead-title">{title}</h1>
        {description ? <p className="mt-1 max-w-3xl text-sm font-semibold text-slate-500">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function EmptyState({ title, hint, icon }: { title: ReactNode; hint?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="ui-empty">
      {icon ? <div className="text-3xl text-slate-300">{icon}</div> : null}
      <p className="ui-empty-text">{title}</p>
      {hint ? <p className="text-xs font-semibold text-slate-400">{hint}</p> : null}
    </div>
  );
}
