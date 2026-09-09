import React, { useState, useRef } from "react";
import { Camera, Sparkles, CheckCircle2, AlertTriangle, ShieldCheck, UploadCloud, ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NetraModalProps {
  orderId: number;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function NetraInstantRefundModal({
  orderId,
  isOpen,
  onClose,
  onSuccess,
}: NetraModalProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [reason, setReason] = useState("Transit bruising & produce crushing");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  if (!isOpen) return null;

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid File", description: "Please upload an image file (JPG/PNG)", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setImagePreview(result);
      setImageBase64(result);
    };
    reader.readAsDataURL(file);
  }

  async function handleRunNetraInspection() {
    if (!imageBase64) {
      toast({ title: "Photo Required", description: "Please snap or upload a photo of the damaged produce", variant: "destructive" });
      return;
    }

    setIsAnalyzing(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/instant-refund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoBase64: imageBase64,
          reason,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || "Failed to inspect photo");
      }

      setAnalysisResult(data);
      if (data.autoApproved) {
        toast({
          title: "🎉 Instant Refund Approved!",
          description: `₹${data.refundAmount} credited to your FarmFresh Wallet immediately!`,
        });
        if (onSuccess) onSuccess();
      } else {
        toast({
          title: "Claim Submitted for Review",
          description: data.message,
        });
      }
    } catch (err: any) {
      toast({
        title: "Inspection Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-emerald-500/40 rounded-3xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
              <Camera size={20} />
            </span>
            <div>
              <h3 className="font-serif font-bold text-base leading-tight">Netra AI Instant Photo Refund</h3>
              <p className="text-[10px] text-muted-foreground">Order #{orderId} · Perishable Damage Guarantee</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80 text-muted-foreground"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {!analysisResult ? (
          <div className="py-4 space-y-3.5 text-xs">
            <p className="text-muted-foreground leading-relaxed">
              Snap a clear photo of the bruised, crushed, or wilted produce. <strong>Netra Vision AI</strong> will
              verify the spoilage cellular signature and automatically refund items under ₹300 directly to your wallet in seconds.
            </p>

            {/* Photo Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/40 hover:border-emerald-500/70 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 bg-emerald-950/10 cursor-pointer transition-colors text-center"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
              {imagePreview ? (
                <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-border">
                  <img src={imagePreview} alt="Damage Preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-bold">
                    Tap to change photo
                  </div>
                </div>
              ) : (
                <>
                  <UploadCloud size={32} className="text-emerald-500" />
                  <span className="font-bold text-foreground">ఫోటో తీయండి లేదా అప్‌లోడ్ చేయండి</span>
                  <span className="text-[11px] text-muted-foreground">Take photo or upload produce image</span>
                </>
              )}
            </div>

            {/* Reason selector */}
            <div>
              <label className="block text-[11px] font-bold text-muted-foreground mb-1">Damage Description</label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full rounded-xl border border-border bg-background p-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="Transit bruising & produce crushing">Transit Bruising / Crushed produce</option>
                <option value="Leafy greens wilted / dehydrated">Leafy greens wilted / lost freshness</option>
                <option value="Premature decay / rot on delivery">Premature rot / decay on arrival</option>
                <option value="Broken container or seal">Damaged packaging / seal broken</option>
              </select>
            </div>

            {/* AI Guarantee Badge */}
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-[11px] text-emerald-800 dark:text-emerald-300">
              <ShieldCheck size={16} className="shrink-0 text-emerald-500" />
              <span>Items under ₹300 are credited instantly with zero waiting time or support tickets.</span>
            </div>

            {/* Inspect Button */}
            <button
              type="button"
              onClick={handleRunNetraInspection}
              disabled={isAnalyzing || !imageBase64}
              className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
            >
              {isAnalyzing ? (
                <>
                  <Sparkles size={16} className="animate-spin text-amber-300" />
                  <span>Netra AI Scanning Cellular Condition...</span>
                </>
              ) : (
                <>
                  <Sparkles size={15} />
                  <span>నైట్రా AI తో స్కాన్ చేసి రీఫండ్ పొందండి (Scan & Refund)</span>
                </>
              )}
            </button>
          </div>
        ) : (
          /* Result View */
          <div className="py-4 space-y-4 text-xs">
            <div className="p-4 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex flex-col items-center text-center gap-2">
              <CheckCircle2 size={36} className="text-emerald-500 animate-bounce" />
              <h4 className="font-serif font-bold text-base text-foreground">
                {analysisResult.autoApproved ? "రీఫండ్ ఆమోదించబడింది (Refund Approved)!" : "పరిశీలనలో ఉంది"}
              </h4>
              <p className="text-muted-foreground text-xs">{analysisResult.message}</p>
              {analysisResult.autoApproved && (
                <div className="text-2xl font-black font-serif text-emerald-600 dark:text-emerald-400 mt-1">
                  +₹{analysisResult.refundAmount}
                </div>
              )}
            </div>

            {analysisResult.analysis?.dataPills && (
              <div className="flex flex-wrap gap-1.5 justify-center">
                {analysisResult.analysis.dataPills.map((pill: any, pIdx: number) => (
                  <span
                    key={pIdx}
                    className="px-2 py-0.5 rounded-full bg-muted text-[10px] font-bold text-foreground border border-border"
                  >
                    {pill.label}: {pill.value}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              పూర్తయింది (Done)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
