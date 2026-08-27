import { imgUrl } from "@/lib/queryClient";

export function Logo({ className = "", hideSubtitle = false }: { className?: string; hideSubtitle?: boolean }) {
  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 group shrink-0 select-none ${className}`} data-testid="logo">
      {/* Official Redesigned FarmFreshFarmer Luminous Emblem */}
      <div className="relative shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-white dark:bg-emerald-950/80 p-1 shadow-[0_4px_16px_rgba(16,185,129,0.35)] border-2 border-emerald-400/80 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
        <img
          src={imgUrl("/images/logo-icon.png")}
          alt="FarmFreshFarmer Logo"
          className="w-full h-full object-contain filter drop-shadow"
        />
        <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border-2 border-background animate-pulse" />
      </div>

      <div className="leading-tight">
        <span className="block font-serif text-base sm:text-lg font-black tracking-tight text-foreground group-hover:text-emerald-500 transition-colors whitespace-nowrap">
          FarmFresh<span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-amber-500 dark:from-emerald-400 dark:to-yellow-300">Farmer</span>
        </span>
        {!hideSubtitle && (
          <span className="hidden sm:block text-[9px] uppercase tracking-[0.2em] font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap mt-0.5">
            Organic · Farm to Home
          </span>
        )}
      </div>
    </div>
  );
}
