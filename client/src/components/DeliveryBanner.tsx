/**
 * DeliveryBanner — Clean, elegant top delivery status bar across the website.
 */
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { MapPin, Clock, X, ChevronRight, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
    if (!navigator.geolocation) { setShowPincodeInput(true); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolveMutation.mutate({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setShowPincodeInput(true),
      { timeout: 8000 }
    );
  };

  const handlePincodeSubmit = () => {
    if (pincode.length >= 4) resolveMutation.mutate({ pincode });
  };


  if (resolution?.serviceable) {
    return (
      <div className="bg-emerald-950/90 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-md z-40 relative shadow-sm">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 mx-auto max-w-7xl w-full">
          {/* Location Area */}
          <span className="flex items-center gap-1.5 font-bold text-amber-400">
            <MapPin className="w-3.5 h-3.5 text-amber-400" />
            <span>Delivering to: <strong className="text-white">{resolution.locationArea || "Your Area"}</strong></span>
          </span>

          {/* Assigned Warehouse */}
          <span className="flex items-center gap-1.5 text-emerald-200">
            <Building2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>Warehouse: <strong className="text-emerald-300">{resolution.warehouseName || "Central Hub"}</strong></span>
          </span>

          {/* Combined Total ETA */}
          {resolution.etaMinutes > 0 && (
            <span className="flex items-center gap-1.5 text-emerald-200">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Total ETA: <strong className="text-white">{resolution.etaMinutes} mins</strong> <span className="text-emerald-400/80">({resolution.packingTimeMinutes || 30}m pack + {resolution.travelTimeMinutes || 0}m transit)</span></span>
            </span>
          )}

          {/* Fee */}
          {resolution.fee === 0 ? (
            <span className="bg-emerald-500/20 text-emerald-300 font-extrabold px-2.5 py-0.5 rounded-full border border-emerald-500/30">Free Delivery</span>
          ) : (
            <span>Fee: <strong className="text-white">₹{resolution.fee}</strong></span>
          )}

          <button
            onClick={() => { setResolution(null); localStorage.removeItem("deliveryResolution"); setShowPincodeInput(true); }}
            className="text-emerald-400 hover:text-white text-xs underline font-semibold ml-auto"
          >
            Change Location
          </button>

        </div>
      </div>
    );
  }

  if (resolution && !resolution.serviceable) {
    return (
      <div className="bg-amber-950/90 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between text-xs text-amber-100 backdrop-blur-md">
        <div className="flex items-center justify-between mx-auto max-w-7xl w-full">
          <span className="flex items-center gap-2 font-semibold">
            <MapPin className="w-4 h-4 text-amber-400" />
            Delivery not available for <strong className="text-white">{resolution.locationArea || (resolution as any).pincode ? `${resolution.locationArea || 'Area'} (${(resolution as any).pincode || ''})` : 'this pincode'}</strong> right now.
          </span>
          <div className="flex items-center gap-3">
            <button onClick={() => { setResolution(null); setShowPincodeInput(true); }} className="text-amber-300 hover:text-white text-xs underline font-semibold">Try another pincode</button>
          </div>
        </div>
      </div>
    );
  }

  if (showPincodeInput) {
    return (
      <div className="bg-emerald-950/90 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-md">
        <div className="flex items-center justify-between mx-auto max-w-7xl w-full">
          <span className="text-emerald-200 flex items-center gap-2 mr-4 font-semibold">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" /> Enter your PIN code to check warehouse delivery ETA
          </span>
          <div className="flex items-center gap-2">
            <Input
              value={pincode}
              onChange={(e) => setPincode(e.target.value)}
              placeholder="e.g. 522002"
              className="w-28 h-7 text-xs bg-black/50 border-emerald-500/40 text-white font-bold"
              onKeyDown={(e) => e.key === "Enter" && handlePincodeSubmit()}
            />
            <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={handlePincodeSubmit} disabled={resolveMutation.isPending || pincode.length < 4}>
              {resolveMutation.isPending ? "..." : <ChevronRight className="w-3.5 h-3.5" />}
            </Button>
            <button onClick={() => setShowPincodeInput(false)}><X className="w-4 h-4 text-emerald-400" /></button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-emerald-950/90 border-b border-emerald-500/20 px-4 py-2 flex items-center justify-between text-xs text-emerald-100 backdrop-blur-md">
      <div className="flex items-center justify-between mx-auto max-w-7xl w-full">
        <span className="flex items-center gap-2 font-semibold">
          <MapPin className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          Enter PIN code to see customer area & assigned warehouse delivery ETA
        </span>
        <div className="flex items-center gap-3">
          <Button size="sm" className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-bold" onClick={requestGpsLocation} disabled={resolveMutation.isPending}>
            Use GPS
          </Button>
          <button onClick={() => setShowPincodeInput(true)} className="text-emerald-300 hover:text-white text-xs underline font-semibold">Enter Pincode</button>
        </div>
      </div>
    </div>
  );
}
