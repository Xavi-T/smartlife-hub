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
    <div className="fixed right-4 bottom-[calc(92px+env(safe-area-inset-bottom))] md:bottom-5 md:right-7 z-1000 flex flex-col gap-2 md:gap-2.5">
      {chatItems.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target={item.external ? "_blank" : undefined}
          rel={item.external ? "noopener noreferrer" : undefined}
          aria-label={item.ariaLabel}
          style={{
            width: 48,
            height: 48,
            borderRadius: "999px",
            display: "grid",
            placeItems: "center",
            textDecoration: "none",
            boxShadow: "0 8px 18px rgba(0,0,0,0.2)",
            border: "2px solid #fff",
            background: "#fff",
            overflow: "hidden",
          }}
        >
          <Image
            src={item.iconSrc}
            alt={item.ariaLabel}
            width={40}
            height={40}
            style={{ display: "block" }}
          />
        </a>
      ))}
    </div>
  );
}
