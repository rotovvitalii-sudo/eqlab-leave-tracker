// Заголовки в стилі eql.systems (spec §11): підпис «/ …» над заголовком сторінки і слеш перед заголовком розділу.

export function PageHeader({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold tracking-wide text-primary uppercase">/ {eyebrow}</p>
      <h1 className="mt-1 text-2xl font-bold sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

export function SectionTitle({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <h2 className="text-lg font-semibold">
      <span className="text-primary">/</span> {children}
      {count !== undefined && <span className="text-muted-foreground"> ({count})</span>}
    </h2>
  );
}
