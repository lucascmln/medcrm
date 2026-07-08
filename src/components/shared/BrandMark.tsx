import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Official InnoveCRM brand mark (the rounded tile + symbol used in the favicon).
 * Renders the shared /icon.png asset so branding stays consistent everywhere.
 */
export function BrandMark({
  size = 32,
  className,
  rounded = "rounded-lg",
  priority = false,
}: {
  size?: number;
  className?: string;
  rounded?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/icon.png"
      alt="InnoveCRM"
      width={size}
      height={size}
      priority={priority}
      className={cn(rounded, className)}
      style={{ width: size, height: size }}
    />
  );
}
