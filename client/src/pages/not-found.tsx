import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Home } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground px-4 text-center">
      <div className="max-w-md w-full p-8 rounded-3xl border border-card-border bg-card/80 backdrop-blur-xl shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mx-auto text-3xl text-emerald-500">
          🌾
        </div>
        
        <div>
          <h1 className="text-4xl font-extrabold text-foreground tracking-tight">404</h1>
          <p className="text-lg font-bold text-foreground/90 mt-2">Page Not Found</p>
          <p className="text-sm text-muted-foreground mt-2">
            The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          <Link href="/">
            <Button className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white rounded-full font-bold text-sm px-6 gap-2">
              <Home size={16} /> Back to Store
            </Button>
          </Link>
          <Button
            variant="outline"
            onClick={() => window.history.back()}
            className="w-full sm:w-auto rounded-full font-bold text-sm px-6 gap-2"
          >
            <ArrowLeft size={16} /> Go Back
          </Button>
        </div>
      </div>
    </div>
  );
}
