import { ImageResponse } from "next/og";
import { BRAND } from "@/lib/brand";

export const alt = "Hotel Asthara, Model Town, Rohtak";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        background: BRAND.navy,
        color: BRAND.ivory,
        padding: 80,
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 650 }}>
        <div style={{ fontSize: 84, lineHeight: 1.05, fontFamily: "serif" }}>Hotel Asthara</div>
        <div style={{ marginTop: 28, fontSize: 36, opacity: 0.8 }}>
          Comfort in the heart of Rohtak
        </div>
        <div style={{ marginTop: 40, width: 120, height: 2, background: BRAND.gold }} />
        <div style={{ marginTop: 28, fontSize: 28, opacity: 0.7 }}>Model Town, Rohtak, Haryana</div>
      </div>
      <svg width="300" height="420" viewBox="0 0 400 560" fill="none">
        <path d="M16 560V202A184 184 0 0 1 384 202V560" stroke={BRAND.gold} strokeWidth="5" />
        <path
          d="M42 560V202A158 158 0 0 1 358 202V560"
          stroke={BRAND.gold}
          strokeWidth="4"
          opacity="0.7"
        />
        <path
          d="M68 560V202A132 132 0 0 1 332 202V560"
          stroke={BRAND.gold}
          strokeWidth="3"
          opacity="0.45"
        />
      </svg>
    </div>,
    size,
  );
}
