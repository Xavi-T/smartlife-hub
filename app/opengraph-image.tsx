import { ImageResponse } from "next/og";
import { APP_CONFIG } from "@/lib/appConfig";
import { toAbsoluteUrl } from "@/lib/seo";

export const runtime = "edge";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

const logoUrl = toAbsoluteUrl("/logoSH_0.png");

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          position: "relative",
          padding: 56,
          background:
            "linear-gradient(135deg, #fffdf7 0%, #f1faee 46%, #e8f4fc 100%)",
          color: "#17365d",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: -120,
            bottom: -180,
            width: 420,
            height: 420,
            borderRadius: 420,
            background: "rgba(95, 190, 66, 0.18)",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -90,
            top: -130,
            width: 420,
            height: 420,
            borderRadius: 420,
            background: "rgba(22, 139, 208, 0.14)",
          }}
        />

        <div
          style={{
            width: "66%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              width: 458,
              padding: "8px 18px",
              borderRadius: 999,
              background: "rgba(255, 255, 255, 0.92)",
              border: "1px solid rgba(22, 139, 208, 0.18)",
            }}
          >
            <img
              src={logoUrl}
              alt={APP_CONFIG.shopName}
              width={84}
              height={84}
              style={{ objectFit: "contain" }}
            />
            <div
              style={{
                display: "flex",
                marginLeft: 14,
                fontSize: 30,
                fontWeight: 800,
              }}
            >
              {APP_CONFIG.shopName}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                maxWidth: 720,
                fontSize: 64,
                fontWeight: 900,
                lineHeight: 1.08,
              }}
            >
              {APP_CONFIG.shopTagline}
            </div>
            <div
              style={{
                display: "flex",
                maxWidth: 720,
                marginTop: 24,
                fontSize: 27,
                lineHeight: 1.45,
                color: "#52677a",
              }}
            >
              Tư vấn dinh dưỡng, tính nhu cầu calo và chọn sản phẩm phù hợp cho
              từng gia đình.
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center" }}>
            {["Dinh dưỡng", "Tính calo", "Mẹ & bé", "Sản phẩm phù hợp"].map(
              (item) => (
                <div
                  key={item}
                  style={{
                    display: "flex",
                    marginRight: 12,
                    padding: "10px 18px",
                    borderRadius: 999,
                    background: "rgba(95, 190, 66, 0.14)",
                    color: "#2e7d22",
                    fontSize: 22,
                    fontWeight: 700,
                  }}
                >
                  {item}
                </div>
              ),
            )}
          </div>
        </div>

        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: 360,
              height: 360,
              borderRadius: 360,
              background: "#ffffff",
              border: "26px solid #e7f5df",
            }}
          />
          <div
            style={{
              position: "absolute",
              width: 250,
              height: 250,
              borderRadius: 250,
              background: "#f7dba3",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 72,
              top: 150,
              width: 120,
              height: 86,
              borderRadius: 48,
              background: "#5fbe42",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 90,
              top: 158,
              width: 118,
              height: 80,
              borderRadius: 44,
              background: "#168bd0",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: 155,
              bottom: 142,
              width: 150,
              height: 100,
              borderRadius: 52,
              background: "#fffdf7",
              border: "14px solid #d8ad6a",
            }}
          />
          <div
            style={{
              position: "absolute",
              right: 56,
              bottom: 48,
              display: "flex",
              flexDirection: "column",
              padding: "18px 22px",
              borderRadius: 24,
              background: "rgba(255, 255, 255, 0.92)",
              border: "1px solid rgba(216, 173, 106, 0.34)",
            }}
          >
            <div style={{ display: "flex", fontSize: 22, fontWeight: 800 }}>
              {APP_CONFIG.shopPhone}
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 6,
                fontSize: 18,
                color: "#52677a",
              }}
            >
              {APP_CONFIG.shopWebsite.replace(/^https?:\/\//, "")}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
