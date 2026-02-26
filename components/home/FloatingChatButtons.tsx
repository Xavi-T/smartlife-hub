"use client";

import Image from "next/image";
import { APP_CONFIG } from "@/lib/appConfig";

const chatItems = [
  {
    key: "messenger",
    ariaLabel: "Chat Messenger",
    href: APP_CONFIG.socials.messenger,
    iconSrc: "/icons/messenger.png",
    external: true,
  },
  {
    key: "zalo",
    ariaLabel: "Chat Zalo",
    href: APP_CONFIG.socials.zalo,
    iconSrc: "/icons/zalo.png",
    external: true,
  },
  {
    key: "phone",
    ariaLabel: "Gọi điện thoại",
    href: `tel:${APP_CONFIG.shopPhone.replace(/\D/g, "")}`,
    iconSrc: "/icons/phone.png",
    external: false,
  },
];

export function FloatingChatButtons() {
  return (
    <div
      style={{
        position: "fixed",
        right: 16,
        bottom: 20,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {chatItems.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
          aria-label={item.ariaLabel}
          style={{
            width: 56,
            height: 56,
            borderRadius: "999px",
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
            boxShadow: "0 10px 24px rgba(0,0,0,0.24)",
            border: "2px solid #fff",
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <Image
            src={item.iconSrc}
            alt={item.ariaLabel}
            width={52}
            height={52}
            style={{ display: "block" }}
          />
        </a>
      ))}
    </div>
  );
}
