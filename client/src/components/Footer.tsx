import { Link } from "wouter";
import { Phone, MapPin, Mail, Instagram, Facebook } from "lucide-react";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-16 bg-sidebar text-sidebar-foreground">
      {/* Trust badges */}
      <div className="border-b border-sidebar-border">
        <div className="mx-auto max-w-7xl px-4 py-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            ["Farm Fresh", "Sourced daily from local farms"],
            ["Instant Delivery", "Same-day in Visakhapatnam"],
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

      <div className="mx-auto max-w-7xl px-4 py-10 grid gap-8 md:grid-cols-4">
        <div>
          <Logo />
          <p className="mt-4 text-sm text-sidebar-foreground/70 max-w-xs">
            A new farm-fresh instant delivery business proudly serving Visakhapatnam, Andhra Pradesh.
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Shop</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80" role="list">
            <li><Link href="/category/fruits" className="hover:text-sidebar-primary">Fruits</Link></li>
            <li><Link href="/category/vegetables" className="hover:text-sidebar-primary">Vegetables</Link></li>
            <li><Link href="/category/homemade-sweets" className="hover:text-sidebar-primary">Homemade Sweets</Link></li>
            <li><Link href="/category/namkeen" className="hover:text-sidebar-primary">Namkeen</Link></li>
            <li><Link href="/category/spices" className="hover:text-sidebar-primary">Spices</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Help</h4>
          <ul className="space-y-2 text-sm text-sidebar-foreground/80" role="list">
            <li><Link href="/orders" className="hover:text-sidebar-primary">My Orders</Link></li>
            <li><Link href="/login" className="hover:text-sidebar-primary">Login / Sign up</Link></li>
            <li><Link href="/cart" className="hover:text-sidebar-primary">Cart & Checkout</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-sm uppercase tracking-wide">Contact</h4>
          <ul className="space-y-3 text-sm text-sidebar-foreground/80" role="list">
            <li className="flex items-start gap-2"><MapPin size={16} className="mt-0.5 shrink-0" /> Visakhapatnam, Andhra Pradesh</li>
            <li className="flex items-center gap-2"><Phone size={16} /> +91 90000 00000</li>
            <li className="flex items-center gap-2"><Mail size={16} /> hello@farmfreshfarmer.com</li>
          </ul>
          <div className="flex gap-3 mt-4">
            <a href="#" aria-label="Instagram" className="p-2 rounded-full bg-sidebar-accent hover-elevate"><Instagram size={16} /></a>
            <a href="#" aria-label="Facebook" className="p-2 rounded-full bg-sidebar-accent hover-elevate"><Facebook size={16} /></a>
          </div>
        </div>
      </div>

      <div className="border-t border-sidebar-border py-4 text-center text-xs text-sidebar-foreground/60">
        © {new Date().getFullYear()} FarmFreshFarmer. All rights reserved.
      </div>
    </footer>
  );
}
