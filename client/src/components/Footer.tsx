import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Phone, MapPin, Mail, Instagram, Facebook, GitCommit } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  const { data: publicSettings } = useQuery<{
    contact_phone?: string;
    contact_email?: string;
    contact_address?: string;
    store_name?: string;
  }>({
    queryKey: ["/api/settings/public"],
    queryFn: async () => {
      const res = await fetch("/api/settings/public");
      return res.json();
    },
  });

  const phone = publicSettings?.contact_phone || "+91 79897 93669";
  const email = publicSettings?.contact_email || "admin@farmfreshfarmer.com";
  const address = publicSettings?.contact_address || "Vijayawada, Andhra Pradesh";
  const storeName = publicSettings?.store_name || "FarmFreshFarmer";

  return (
    <footer className="mt-16 bg-sidebar text-sidebar-foreground">
      {/* Trust badges */}
      <div className="border-b border-sidebar-border">
        <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["Farm Fresh", "Sourced daily from local farms"],
            ["Instant Delivery", "Same-day delivery"],
            ["Homemade", "Sweets & pickles made with love"],
            ["No Preservatives", "Pure, natural taste"],
          ].map(([t, d]) => (
            <div key={t}>
              <p className="font-serif text-base font-bold text-sidebar-primary">{t}</p>
              <p className="text-xs text-sidebar-foreground/70 mt-1">{d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-5">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-sidebar-foreground/70 max-w-xs">
            A new farm-fresh instant delivery business proudly serving you.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Quick Links</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80" role="list">
            <li><Link href="/" className="hover:text-sidebar-primary">Home</Link></li>
            <li><Link href="/subscriptions" className="hover:text-sidebar-primary">Subscriptions</Link></li>
            <li><Link href="/referrals" className="hover:text-sidebar-primary">Referrals</Link></li>
            <li><Link href="/cart" className="hover:text-sidebar-primary">Cart</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Categories</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80" role="list">
            <li><Link href="/category/fruits" className="hover:text-sidebar-primary">Fruits</Link></li>
            <li><Link href="/category/vegetables" className="hover:text-sidebar-primary">Vegetables</Link></li>
            <li><Link href="/category/homemade-sweets" className="hover:text-sidebar-primary">Homemade Sweets</Link></li>
            <li><Link href="/category/pickles-veg" className="hover:text-sidebar-primary">Pickles</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Legal</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80" role="list">
            <li><Link href="/terms" className="hover:text-sidebar-primary">Terms & Conditions</Link></li>
            <li><Link href="/privacy" className="hover:text-sidebar-primary">Privacy Policy</Link></li>
            <li><Link href="/refund-policy" className="hover:text-sidebar-primary">Refund & Cancellation</Link></li>
            <li><Link href="/shipping-policy" className="hover:text-sidebar-primary">Shipping & Delivery</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Contact</h4>
          <ul className="space-y-3 text-sm text-sidebar-foreground/80" role="list">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> {address}</li>
            <li className="flex items-center gap-2"><Phone size={16} /> {phone}</li>
            <li className="flex items-center gap-2"><Mail size={16} /> {email}</li>
          </ul>
          <div className="flex gap-3 mt-4">
            <a href="https://www.instagram.com/farmfreshfarmer/" aria-label="Instagram" className="p-2 rounded-full bg-sidebar-accent hover-elevate"><Instagram size={16} /></a>
            <a href="#" aria-label="Facebook" className="p-2 rounded-full bg-sidebar-accent hover-elevate"><Facebook size={16} /></a>
          </div>
        </div>
      </div>

      <div className="border-t border-sidebar-border py-4 text-center text-xs text-sidebar-foreground/60 flex items-center justify-center gap-2 flex-wrap px-4">
        <span>© {new Date().getFullYear()} FarmFreshFarmer. All rights reserved.</span>
        <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-sm">
          <GitCommit size={10} />
        v7.2.6
        </span>
      </div>
    </footer>
  );
}
