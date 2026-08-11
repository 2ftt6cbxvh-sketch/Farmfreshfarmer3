import { imgUrl } from "@/lib/queryClient";

export function Logo({ className = "", hideSubtitle = false }: { className?: string; hideSubtitle?: boolean }) {
  return (
    <div className={`flex items-center gap-2 sm:gap-2.5 group shrink-0 ${className}`} data-testid="logo">
      {/* Official Redesigned FarmFreshFarmer Transparent Emblem */}
      <div className="relative shrink-0 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center group-hover:scale-105 transition-all duration-300">
        <img
          src={imgUrl("/images/logo-icon.png")}
          alt="FarmFreshFarmer Logo"
          className="w-full h-full object-contain filter drop-shadow-sm"
        />
      </div>

      <div className="leading-tight">
        <span className="block font-serif text-base sm:text-lg font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors whitespace-nowrap">
          FarmFresh<span className="text-emerald-500">Farmer</span>
        </span>
        {!hideSubtitle && (
          <span className="hidden sm:block text-[9px] uppercase tracking-[0.18em] font-bold text-emerald-600/90 dark:text-emerald-400/90 whitespace-nowrap">
            Organic · Farm to Home
          </span>
        )}
      </div>
    </div>
  );
}
