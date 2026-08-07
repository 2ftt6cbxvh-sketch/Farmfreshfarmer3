import { imgUrl } from "@/lib/queryClient";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-3 group ${className}`} data-testid="logo">
      {/* Official Generated FarmFreshFarmer App Icon Asset */}
      <div className="relative shrink-0 w-10 h-10 rounded-xl overflow-hidden shadow-md group-hover:scale-105 group-hover:shadow-primary/30 transition-all duration-300 ring-2 ring-primary/20">
        <img
          src={imgUrl("/images/logo-icon.png")}
          alt="FarmFreshFarmer Logo"
          className="w-full h-full object-cover"
        />
      </div>

      <div className="leading-tight">
        <span className="block font-serif text-lg font-extrabold text-foreground tracking-tight group-hover:text-primary transition-colors">
          FarmFresh<span className="text-accent">Farmer</span>
        </span>
        <span className="block text-[9px] uppercase tracking-[0.2em] font-semibold text-muted-foreground">
          Organic · Farm to Home
        </span>
      </div>
    </div>
  );
}
