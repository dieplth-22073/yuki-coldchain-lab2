import type { ReactNode } from 'react';

export function PageHeader({ title, lead }: { title: string; lead?: string }) {
  return (
    <div className="mb-6">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      {lead && <p className="mt-1 text-sm text-slate-600">{lead}</p>}
    </div>
  );
}

export function Card({
  title,
  children,
  footer,
}: {
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white shadow-sm">
      {title && (
        <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold">
          {title}
        </h2>
      )}
      <div className="p-4">{children}</div>
      {footer && <div className="border-t border-slate-100 px-4 py-3">{footer}</div>}
    </section>
  );
}

const TONES = {
  neutral: 'bg-slate-100 text-slate-700',
  good: 'bg-emerald-100 text-emerald-800',
  warn: 'bg-amber-100 text-amber-900',
  bad: 'bg-rose-100 text-rose-800',
  info: 'bg-sky-100 text-sky-800',
} as const;

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  'w-full rounded border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900';

export function Alert({
  tone,
  title,
  children,
}: {
  tone: 'good' | 'warn' | 'bad' | 'info';
  title: string;
  children?: ReactNode;
}) {
  const ring = {
    good: 'border-emerald-300 bg-emerald-50',
    warn: 'border-amber-300 bg-amber-50',
    bad: 'border-rose-300 bg-rose-50',
    info: 'border-sky-300 bg-sky-50',
  }[tone];
  return (
    <div className={`rounded-lg border p-4 ${ring}`}>
      <p className="text-sm font-semibold">{title}</p>
      {children && <div className="mt-1 text-sm text-slate-700">{children}</div>}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="py-8 text-center text-sm text-slate-500">{children}</p>;
}
