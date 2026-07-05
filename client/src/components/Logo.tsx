export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} data-testid="logo">
      <svg width="38" height="38" viewBox="0 0 32 32" aria-hidden="true" className="shrink-0">
        <rect width="32" height="32" rx="9" fill="hsl(var(--primary))" />
        <path
          d="M16 6c-6 2-9 6-9 11 0 4 3 8 9 9 0-7 1-12 7-16-3 0-5 .5-7 1.8C15 9 15 7.5 16 6Z"
          fill="hsl(var(--accent))"
        />
        <path
          d="M11 24c2-6 5-9 10-11"
          stroke="white"
          strokeWidth="1.4"
          fill="none"
          strokeLinecap="round"
        />
      </svg>
      <div className="leading-none">
        <span className="block font-serif text-lg font-bold text-primary tracking-tight">
          FarmFresh<span className="text-accent">Farmer</span>
        </span>
        <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          Fresh from the farm
        </span>
      </div>
    </div>
  );
}
