/**
 * DeliveryBanner — Sleek 3D Glass top delivery status bar with perpetual GPS detection & animated pincode checking.
 */
import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Clock, X, ChevronRight, Building2, Navigation, Compass, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DeliveryResolution {
  serviceable: boolean;
  fee: number;
  etaMinutes: number;
  packingTimeMinutes?: number;
  travelTimeMinutes?: number;
  warehouseName?: string;
  locationArea?: string;
  distanceKm?: number;
  reason?: string;
  pincode?: string;
}

export default function DeliveryBanner() {
  const [pincode, setPincode] = useState("");
  const [showPincodeInput, setShowPincodeInput] = useState(false);
  const [resolution, setResolution] = useState<DeliveryResolution | null>(() => {
    try { return JSON.parse(localStorage.getItem("deliveryResolution") || "null"); } catch { return null; }
  });

  const resolveMutation = useMutation({
    mutationFn: async (payload: { lat?: number; lng?: number; pincode?: string }) => {
      const res = await fetch("/api/delivery/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      return res.json();
    },
    onSuccess: (data: DeliveryResolution) => {
      setResolution(data);
      localStorage.setItem("deliveryResolution", JSON.stringify(data));
      setShowPincodeInput(false);
    },
  });

  const requestGpsLocation = () => {
    const fallbackResolution = {
      serviceable: false,
      fee: 0,
      etaMinutes: 0,
      reason: 'No active warehouse configured in Admin Panel'
    };

    if (!navigator.geolocation) {
      setResolution(fallbackResolution);
      localStorage.setItem("deliveryResolution", JSON.stringify(fallbackResolution));
      setShowPincodeInput(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => resolveMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {
        setResolution(fallbackResolution);
        localStorage.setItem("deliveryResolution", JSON.stringify(fallbackResolution));
        setShowPincodeInput(false);
      },
      { timeout: 8000 }
    );
  };

  useEffect(() => {
    if (!localStorage.getItem("deliveryResolution") && navigator.geolocation) {
      requestGpsLocation();
    }
  }, []);

  const handlePincodeSubmit = () => {
    if (pincode.trim().length >= 4) resolveMutation.mutate({ pincode: pincode.trim() });
  };

  // Reusable 'Detect My Location' Button Component
  const DetectLocationBtn = () => (
    <button
      onClick={requestGpsLocation}
      disabled={resolveMutation.isPending}
      className="inline-flex items-center gap-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 hover:text-white font-extrabold text-[11px] px-3 py-1 rounded-full border border-emerald-500/40 backdrop-blur-md shadow-sm transition-all duration-200 active:scale-95 disabled:opacity-50"
      title="Detect live GPS location anytime"
    >
      <Navigation className={`w-3 h-3 text-emerald-400 ${resolveMutation.isPending ? "animate-spin" : "animate-pulse"}`} />
      <span>{resolveMutation.isPending ? "Detecting…" : "Detect My Location"}</span>
    </button>
  );

  // RESOLVED SERVICEABLE BANNER
  if (resolution?.serviceable) {
    return (
      <div className="bg-gradient-to-r from-emerald-950/95 via-black/90 to-emerald-950/95 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-2xl z-40 relative shadow-xl animate-mobile-drawer">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 mx-auto max-w-7xl w-full truncate">
          <span className="flex items-center gap-1.5 font-bold text-amber-400 truncate w-full sm:w-auto justify-center sm:justify-start">
            <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">Delivering to: <strong className="text-white">{resolution.locationArea}{resolution.pincode ? ` (PIN ${resolution.pincode})` : ""}</strong></span>
          </span>

          {resolution.etaMinutes > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-200 truncate w-full sm:w-auto justify-center sm:justify-start">
              <Clock className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <strong className="text-white truncate">⚡ {resolution.etaMinutes} Mins Express Delivery • {resolution.warehouseName}</strong>
            </span>
          )}

          <div className="flex items-center gap-2 ml-auto w-full sm:w-auto justify-center sm:justify-end mt-1 sm:mt-0">
            <DetectLocationBtn />
            <button
              onClick={() => { setResolution(null); localStorage.removeItem("deliveryResolution"); setShowPincodeInput(true); }}
              className="text-emerald-400 hover:text-white text-xs underline font-semibold shrink-0"
            >
              Enter Pincode
            </button>
          </div>
        </div>
      </div>
    );
  }

  // RESOLVED NON-SERVICEABLE BANNER
  if (resolution && !resolution.serviceable) {
    return (
      <div className="bg-gradient-to-r from-amber-950/95 via-black/90 to-amber-950/95 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-100 backdrop-blur-2xl shadow-xl animate-mobile-drawer">
        <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 justify-between mx-auto max-w-7xl w-full truncate">
          <span className="flex items-center gap-2 font-semibold truncate w-full sm:w-auto justify-center sm:justify-start">
            <MapPin className="w-4 h-4 text-amber-400 shrink-0" />
            <strong className="text-white font-extrabold shrink-0">Location Not Covered Yet</strong>
            <span className="ml-2 truncate">We are expanding fast! Enter your PIN code to check serviceability.</span>
          </span>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end mt-1 sm:mt-0">
            <DetectLocationBtn />
            <button onClick={() => { setResolution(null); setShowPincodeInput(true); }} className="text-amber-300 hover:text-white text-xs underline font-semibold shrink-0">Try Pincode</button>
          </div>
        </div>
      </div>
    );
  }

  // SLEEK ANIMATED PINCODE INPUT BAR
  if (showPincodeInput) {
    return (
      <div className="bg-gradient-to-r from-emerald-950/95 via-black/90 to-emerald-950/95 border-b border-emerald-500/30 px-4 py-2.5 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-2xl shadow-xl animate-mobile-drawer">
        <div className="flex flex-wrap items-center justify-between mx-auto max-w-7xl w-full gap-3">
          <span className="text-emerald-200 flex items-center gap-2 font-semibold">
            <MapPin className="w-4 h-4 text-emerald-400 animate-pulse" />
            Enter PIN code to check warehouse delivery ETA & customer area
          </span>
          <div className="flex items-center gap-2.5">
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-3 text-emerald-400/70" />
              <input
                type="text"
                maxLength={6}
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                placeholder="e.g. 522002"
                className="w-32 h-8 text-xs bg-black/60 border border-emerald-500/40 rounded-xl pl-8 pr-3 text-white font-extrabold tracking-wider placeholder:text-emerald-500/50 focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-400 transition-all outline-none"
                onKeyDown={(e) => e.key === "Enter" && handlePincodeSubmit()}
              />
            </div>
            <button
              onClick={handlePincodeSubmit}
              disabled={resolveMutation.isPending || pincode.length < 4}
              className="h-8 text-xs bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-extrabold px-3.5 rounded-xl shadow-md hover:scale-105 active:scale-95 transition-all duration-200 disabled:opacity-40 flex items-center gap-1"
            >
              <span>{resolveMutation.isPending ? "Checking…" : "Check ETA"}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
            <DetectLocationBtn />
            <button onClick={() => setShowPincodeInput(false)} className="text-emerald-400 hover:text-white p-1" title="Close"><X className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    );
  }

  // DEFAULT PROMPT BANNER
  return (
    <div className="bg-gradient-to-r from-emerald-950/95 via-black/90 to-emerald-950/95 border-b border-emerald-500/30 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-2xl shadow-xl animate-mobile-drawer">
      <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-6 justify-between mx-auto max-w-7xl w-full truncate">
        <span className="flex items-center gap-2 font-semibold truncate w-full sm:w-auto justify-center sm:justify-start">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse shrink-0" />
          <strong className="text-white font-extrabold shrink-0">Select Delivery Location</strong>
          <span className="ml-2 truncate">Enter PIN code to check instant farm delivery ETA</span>
        </span>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end mt-1 sm:mt-0">
          <DetectLocationBtn />
          <button onClick={() => setShowPincodeInput(true)} className="text-emerald-300 hover:text-white text-xs underline font-semibold shrink-0">Enter Pincode</button>
        </div>
      </div>
    </div>
  );
}
