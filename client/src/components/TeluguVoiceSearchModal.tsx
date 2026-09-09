import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, ShoppingBag, Sparkles, Check, AlertCircle } from "lucide-react";
import { useCart } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface ParsedItem {
  productId: number;
  name: string;
  nameTe?: string | null;
  requestedQty: number;
  matchedUnit: string;
  unitPrice: number;
  totalPrice: number;
}

export function TeluguVoiceSearchModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [loading, setLoading] = useState(false);
  const [parsedResult, setParsedResult] = useState<{
    recognizedItems: ParsedItem[];
    teluguConfirmation: string;
  } | null>(null);
  const recognitionRef = useRef<any>(null);
  const { add } = useCart();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    if (!isOpen) {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
      setIsListening(false);
      setTranscript("");
      setParsedResult(null);
      return;
    }

    startListening();
  }, [isOpen]);

  function startListening() {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast({
        title: "Microphone Not Supported",
        description: "Your browser does not support voice speech recognition. Please type your query.",
        variant: "destructive",
      });
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "te-IN"; // Telugu (India)
      recognition.interimResults = true;
      recognition.continuous = false;

      recognition.onstart = () => {
        setIsListening(true);
        setTranscript("");
      };

      recognition.onresult = (event: any) => {
        let current = "";
        for (let i = 0; i < event.results.length; i++) {
          current += event.results[i][0].transcript;
        }
        setTranscript(current);
      };

      recognition.onerror = (e: any) => {
        console.warn("Speech recognition error:", e.error);
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      console.error("Failed to start voice recognition:", err);
      setIsListening(false);
    }
  }

  async function handleAnalyzeTranscript(textToAnalyze?: string) {
    const text = textToAnalyze || transcript;
    if (!text.trim()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/voice-order/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript: text }),
      });
      const data = await res.json();
      setParsedResult(data);
    } catch (err: any) {
      toast({
        title: "Voice Parse Error",
        description: "Could not understand voice dialect. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function handleAddAllToCart() {
    if (!parsedResult?.recognizedItems?.length) return;

    let addedCount = 0;
    for (const item of parsedResult.recognizedItems) {
      // Mock minimal product struct for cart
      const mockProduct: any = {
        id: item.productId,
        name: item.name,
        nameTe: item.nameTe,
        price: String(item.unitPrice),
        unit: item.matchedUnit,
        stock: 50,
      };
      add(mockProduct, item.requestedQty);
      addedCount++;
    }

    toast({
      title: "🌾 బుట్టలోకి చేర్చబడ్డాయి (Added to Basket)!",
      description: `${addedCount} fresh Telugu farm produce items added to your cart.`,
    });

    onClose();
    setLocation("/cart");
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-card text-card-foreground border border-emerald-500/30 rounded-3xl shadow-2xl max-w-md w-full p-6 relative overflow-hidden flex flex-col items-center text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-border mb-4">
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-xl bg-emerald-500/15 text-emerald-500">
              <Volume2 size={20} />
            </span>
            <div className="text-left">
              <h3 className="font-serif font-bold text-base leading-tight">మాట్లాడి ఆర్డర్ చేయండి</h3>
              <p className="text-[11px] text-muted-foreground">Telugu Voice Smart Dialect Order</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-xs hover:bg-muted/80 text-muted-foreground"
          >
            ✕
          </button>
        </div>

        {/* Pulse Mic Orb */}
        <div className="my-3 relative flex items-center justify-center">
          {isListening && (
            <div className="absolute w-28 h-28 rounded-full bg-emerald-500/20 animate-ping pointer-events-none" />
          )}
          <button
            type="button"
            onClick={isListening ? () => recognitionRef.current?.stop() : startListening}
            className={`w-20 h-20 rounded-full flex items-center justify-center shadow-xl transition-all cursor-pointer ${
              isListening
                ? "bg-gradient-to-tr from-red-600 to-rose-500 text-white scale-110 shadow-red-500/40"
                : "bg-gradient-to-tr from-emerald-600 to-teal-500 text-white hover:scale-105 shadow-emerald-500/30"
            }`}
          >
            {isListening ? <Mic size={32} className="animate-pulse" /> : <MicOff size={30} />}
          </button>
        </div>

        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-2">
          {isListening ? "వింటున్నాము... మాట్లాడండి (Listening... speak now)" : "మైక్రోఫోన్ నొక్కి మాట్లాడండి"}
        </p>

        {/* Dialect Prompt Suggestions */}
        <div className="mt-3 p-2.5 rounded-2xl bg-muted/40 border border-border/60 text-left w-full">
          <p className="text-[10px] text-muted-foreground mb-1.5 font-bold uppercase tracking-wider">
            💡 మీరు ఇలా చెప్పవచ్చు (Example Telugu Phrases):
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "రెండు కిలోల నాటు టమోటాలు",
              "అరకిలో బెండకాయలు",
              "ఒక కట్ట కొత్తిమీర",
              "ఆవకాయ మరియు బూందీ లడ్డూ",
            ].map((sample, sIdx) => (
              <button
                key={sIdx}
                type="button"
                onClick={() => {
                  setTranscript(sample);
                  handleAnalyzeTranscript(sample);
                }}
                className="text-[10px] bg-card hover:bg-emerald-500/10 hover:text-emerald-500 border border-border px-2 py-1 rounded-lg transition-colors cursor-pointer"
              >
                "{sample}"
              </button>
            ))}
          </div>
        </div>

        {/* Live Transcript Display */}
        {transcript && (
          <div className="mt-4 p-3 rounded-xl bg-card border border-emerald-500/30 text-left w-full">
            <span className="text-[10px] font-bold text-muted-foreground uppercase">మీరు చెప్పినది (Transcribed):</span>
            <p className="text-sm font-medium mt-1 italic text-foreground">"{transcript}"</p>
            {!parsedResult && !loading && (
              <button
                type="button"
                onClick={() => handleAnalyzeTranscript()}
                className="mt-2.5 w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Sparkles size={14} /> గుర్తించు (Detect & Add)
              </button>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="my-4 flex items-center gap-2 text-xs font-bold text-emerald-500 animate-pulse">
            <Sparkles size={16} className="animate-spin" />
            <span>లక్ష్మీ AI మీ భాషను విశ్లేషిస్తోంది (Analyzing Telugu dialect)...</span>
          </div>
        )}

        {/* Parsed Result Display */}
        {parsedResult && (
          <div className="mt-4 w-full text-left space-y-2">
            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs font-bold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
              <Check size={16} className="text-emerald-500 shrink-0" />
              <span>{parsedResult.teluguConfirmation}</span>
            </div>

            {parsedResult.recognizedItems.length > 0 ? (
              <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                {parsedResult.recognizedItems.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-card border border-border flex items-center justify-between text-xs"
                  >
                    <div>
                      <div className="font-bold text-foreground">{item.name}</div>
                      {item.nameTe && <div className="text-[10px] text-emerald-500">{item.nameTe}</div>}
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-primary">₹{item.totalPrice}</div>
                      <div className="text-[10px] text-muted-foreground">{item.matchedUnit} × {item.requestedQty}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
                <AlertCircle size={14} />
                <span>క్షమించండి, మీ మాటలలోని పంటల వివరాలు సరిపోలలేదు. పై ఉదాహరణలను ప్రయత్నించండి.</span>
              </div>
            )}

            {parsedResult.recognizedItems.length > 0 && (
              <button
                type="button"
                onClick={handleAddAllToCart}
                className="mt-3 w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black shadow-lg shadow-emerald-600/30 flex items-center justify-center gap-2 cursor-pointer transition-all"
              >
                <ShoppingBag size={15} />
                <span>అన్నీ బుట్టలో వేయి (Add All to Cart)</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
