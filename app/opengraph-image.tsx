import { ImageResponse } from "next/og";
import { APP_CONFIG } from "@/lib/appConfig";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1d4ed8 55%, #38bdf8 100%)",
          color: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 28,
            opacity: 0.9,
          }}
        >
          smartlife-hub.shop
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              display: "flex",
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: -1,
              maxWidth: 980,
            }}
          >
            {APP_CONFIG.shopName}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 38,
              opacity: 0.95,
              maxWidth: 980,
            }}
          >
            {APP_CONFIG.shopTagline}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 24,
            opacity: 0.92,
          }}
        >
          <div style={{ display: "flex" }}>{APP_CONFIG.shopPhone}</div>
          <div style={{ display: "flex" }}>{APP_CONFIG.shopWebsite}</div>
        </div>
      </div>
    ),
    size,
  );
}
