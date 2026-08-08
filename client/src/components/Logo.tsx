import { imgUrl } from "@/lib/queryClient";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 sm:gap-3 group shrink-0 ${className}`} data-testid="logo">
      {/* Official Generated FarmFreshFarmer App Icon Asset */}
      <div className="relative shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl overflow-hidden shadow-md group-hover:scale-105 transition-all duration-300 ring-2 ring-primary/20">
        <img
          src={imgUrl("/images/logo-icon.png")}
          alt="FarmFreshFarmer Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="leading-tight">
        <span className="block font-serif text-base sm:text-lg font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors whitespace-nowrap">
          FarmFresh<span className="text-accent">Farmer</span>
        </span>
        <span className="hidden sm:block text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground whitespace-nowrap">
          Organic · Farm to Home
        </span>
      </div>
    </div>
  );
}
