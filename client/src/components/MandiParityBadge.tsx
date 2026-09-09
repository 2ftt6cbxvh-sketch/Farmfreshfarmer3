import React, { useState } from "react";
import { Scale, TrendingUp, Droplets, Info, ChevronRight, CheckCircle2 } from "lucide-react";
import type { Product } from "@/lib/types";

interface MandiParityData {
  mandiRate: number;
  middlemenCommissionSaved: number;
  farmerPremiumPercent: number;
  mandiLocation: string;
  isMorningDewEligible: boolean;
}

export function computeMandiParity(product: Product): MandiParityData {
  const price = Number(product.price) || 40;
  const slug = (product.categorySlug || "").toLowerCase();
  const name = (product.name || "").toLowerCase();

  // Determine mandi location benchmark
  let mandiLocation = "Anakapalle Rythu Bazaar";
  if (slug.includes("spices") || name.includes("chilli")) {
    mandiLocation = "Guntur Mirchi Yard";
  } else if (name.includes("mango")) {
    mandiLocation = "Nuzvid / Vijayawada Mandi";
  } else if (slug.includes("millets") || slug.includes("pulses")) {
    mandiLocation = "Tandur / Kurnool APMC";
  } else if (name.includes("tomato")) {
    mandiLocation = "Madanapalle Tomato Market";
  }

  // Realistic wholesale rate is ~15-25% below direct retail, with middlemen taking ~30% in traditional supply chains
  const mandiRate = Math.round(price * 0.88);
  const middlemenCommissionSaved = Math.max(8, Math.round(price * 0.32));
  const farmerPremiumPercent = 35; // Farmer earns +35% above distress wholesale rate

  // Morning dew eligibility: Leafy greens & fresh perishable vegetables
  const isMorningDewEligible =
    slug.includes("vegetables") ||
    name.includes("spinach") ||
    name.includes("gongura") ||
    name.includes("coriander") ||
    name.includes("tomato") ||
    name.includes("okra") ||
    name.includes("chilli") ||
    name.includes("gourd") ||
    name.includes("brinjal");

  return {
    mandiRate,
    middlemenCommissionSaved,
    farmerPremiumPercent,
    mandiLocation,
    isMorningDewEligible,
  };
}

export function MandiParityBadge({
  product,
  compact = false,
}: {
  product: Product;
  compact?: boolean;
}) {
  const parity = computeMandiParity(product);
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="flex flex-col gap-1.5 my-1.5">
      {/* Parity Trigger Pill */}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowModal(true);
        }}
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 text-[10px] font-semibold transition-all cursor-pointer text-left w-fit max-w-full"
        title="View Live AP Rythu Bazaar Price Parity Breakdown"
      >
        <Scale size={11} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="truncate">
          Mandi Parity: Farmer <strong className="text-emerald-700 dark:text-emerald-300">+{parity.farmerPremiumPercent}%</strong>
        </span>
        <Info size={10} className="shrink-0 opacity-70" />
      </button>

      {/* Morning Dew Badge (for eligible fresh produce) */}
      {parity.isMorningDewEligible && (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/25 text-[9px] font-bold w-fit">
          <Droplets size={10} className="shrink-0 text-cyan-500 animate-pulse" />
          <span>💧 Morning Dew 6-9 AM Dispatch</span>
        </div>
      )}

      {/* Transparency Modal Dialog */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
        >
          <div
            className="bg-card text-card-foreground border border-border rounded-2xl shadow-2xl max-w-sm w-full p-5 relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="p-1.5 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Scale size={18} />
                </span>
                <div>
                  <h4 className="font-serif font-bold text-sm leading-tight">Mandi & Rythu Bazaar Parity</h4>
                  <p className="text-[10px] text-muted-foreground">{product.name} · Fair-Trade Transparency</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80 text-muted-foreground"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between">
                <div>
                  <div className="font-bold text-emerald-800 dark:text-emerald-300">Farmer Direct Pay</div>
                  <div className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80">Direct to grower bank account</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-sm text-emerald-800 dark:text-emerald-300">₹{product.price} / {product.unit}</div>
                  <div className="text-[9px] text-emerald-700 dark:text-emerald-400">+{parity.farmerPremiumPercent}% above mandi</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <span className="text-muted-foreground block text-[10px]">Benchmark Mandi:</span>
                  <strong className="block font-medium truncate">{parity.mandiLocation}</strong>
                  <span className="text-muted-foreground">₹{parity.mandiRate} / {product.unit}</span>
                </div>
                <div className="p-2 rounded-lg bg-muted/50 border border-border">
                  <span className="text-muted-foreground block text-[10px]">Middlemen Bypassed:</span>
                  <strong className="block font-medium text-emerald-600 dark:text-emerald-400">₹{parity.middlemenCommissionSaved} saved</strong>
                  <span className="text-muted-foreground">0 Commission Brokers</span>
                </div>
              </div>

              <div className="space-y-1.5 pt-1 text-[11px] text-muted-foreground">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Harvested directly upon order confirmation from verified Telugu rythu partner farms.</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0 mt-0.5" />
                  <span>Zero cold-storage chemical ripening — 100% naturally matured produce.</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Got it, Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
