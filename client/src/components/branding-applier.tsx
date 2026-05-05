import { useEffect } from "react";
import { useAgency } from "@/hooks/use-agency";

export function BrandingApplier() {
  const { agency } = useAgency();
  useEffect(() => {
    document.documentElement.style.setProperty("--agency-brand", agency.brandColor);
  }, [agency.brandColor]);
  return null;
}
