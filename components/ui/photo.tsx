import Image from "next/image";
import { cn } from "@/lib/utils";

/** next/image when a photo exists, otherwise a quiet branded placeholder, so the layout never shows a broken image. */
export function Photo({
  src,
  alt,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  priority,
  className,
  imgClassName,
}: {
  src?: string | null;
  alt: string;
  sizes?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        src ? "bg-surface-3" : "theme-dark bg-bg",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={sizes}
          priority={priority}
          className={cn("object-cover", imgClassName)}
        />
      ) : (
        <div role="img" aria-label={alt} className="absolute inset-0 grid place-items-center">
          <svg
            viewBox="0 0 120 150"
            className="text-accent h-1/2 max-h-40 w-auto"
            fill="none"
            aria-hidden
          >
            <path
              d="M12 148V62C12 30 33 8 60 8s48 22 48 54v86"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <path
              d="M28 148V64c0-24 14-42 32-42s32 18 32 42v84"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.6"
            />
            <path
              d="M44 148V68c0-14 7-26 16-26s16 12 16 26v80"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.35"
            />
          </svg>
        </div>
      )}
    </div>
  );
}
