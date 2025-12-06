import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import LogoLight from "@/assets/PhishNet_light.png";
import LogoDark from "@/assets/PhishNet_dark.png";

interface LogoProps {
  className?: string;
  alt?: string;
}
// Logo component that adapts to light and dark themes
export function Logo({ className = "h-6 w-6", alt = "PhishNet Logo" }: LogoProps) {
  const { theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);
  }, []);
  // If not mounted, return a placeholder div
  if (!mounted) {
    // Return a placeholder to avoid hydration mismatch
    return <div className={className} />;
  }

  // Determine which logo to use based on theme
  // Use resolvedTheme which will be either 'light' or 'dark' after system resolution
  const currentTheme = resolvedTheme || theme;
  const logoSrc = currentTheme === "dark" ? LogoDark : LogoLight;

  return <img src={logoSrc} alt={alt} className={className} />;
}
