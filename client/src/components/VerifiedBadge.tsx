import { Check } from "lucide-react";

interface VerifiedBadgeProps {
  size?: "sm" | "md" | "lg";
  className?: string;
  showTooltip?: boolean;
}

export function VerifiedBadge({ size = "md", className = "", showTooltip = true }: VerifiedBadgeProps) {
  const sizeMap = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-5 h-5",
  };

  const iconSizeMap = {
    sm: 8,
    md: 10,
    lg: 12,
  };

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 rounded-full bg-gradient-to-tr from-sky-600 to-blue-500 text-white shadow-[0_0_8px_rgba(56,189,248,0.6)] border border-sky-300/40 select-none ${sizeMap[size]} ${className}`}
      title={showTooltip ? "Super Admin Verified Genuine Customer" : undefined}
      aria-label="Verified Genuine Account"
    >
      <Check size={iconSizeMap[size]} strokeWidth={3.5} className="text-white" />
    </span>
  );
}
