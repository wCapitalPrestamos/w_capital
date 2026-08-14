import { Suspense } from "react";
import { HeaderSearch } from "@/components/header-search";
import { ThemeToggle } from "@/components/theme-toggle";

export function PageHeader({
  title,
  crumb,
  description,
  children,
}: {
  title: string;
  crumb?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  const eyebrow = crumb ?? description;

  return (
    <header suppressHydrationWarning className="sticky top-0 z-20 flex flex-wrap items-center gap-4 border-b border-line-2 bg-background px-8 py-4.5">
      <div className="min-w-0 flex-1">
        {eyebrow && (
          <p className="mb-0.5 text-[11px] tracking-[.09em] uppercase text-ink-3">
            {eyebrow}
          </p>
        )}
        <h1 className="font-serif text-[30px] leading-[1.1] font-normal tracking-[-.01em]">
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2.5">
        <Suspense>
          <HeaderSearch />
        </Suspense>
        <ThemeToggle />
        {children}
      </div>
    </header>
  );
}
