import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BRAND.navy,
      }}
    >
      <svg width="120" height="120" viewBox="0 0 64 64" fill="none">
        <path
          d="M16 52V30a16 16 0 0 1 32 0v22"
          stroke={BRAND.gold}
          strokeWidth="2.6"
          strokeLinecap="round"
        />
        <path
          d="M24 52V31a8 8 0 0 1 16 0v21"
          stroke={BRAND.gold}
          strokeWidth="2.2"
          strokeLinecap="round"
          opacity="0.65"
        />
      </svg>
    </div>,
    size,
  );
}
