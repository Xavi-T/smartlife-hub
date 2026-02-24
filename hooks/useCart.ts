"use client";

import { useState, useEffect } from "react";
import type { Product } from "@/types/database";
import {
  calculateDiscountedPrice,
  getEffectiveDiscountPercent,
} from "@/lib/utils";
import { trackAddToCart, trackRemoveFromCart } from "@/lib/analytics";

export interface CartItem {
  product: Product;
  quantity: number;
}

export function useCart() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load cart from localStorage
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const savedCart = localStorage.getItem("smartlife-cart");
      if (savedCart) {
        try {
          setCart(JSON.parse(savedCart));
        } catch (error) {
          console.error("Error loading cart:", error);
        }
      }
      setIsLoaded(true);
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("smartlife-cart", JSON.stringify(cart));
    }
  }, [cart, isLoaded]);

  const addToCart = (product: Product, quantity: number = 1) => {
    const safeQuantity = Math.max(1, Math.floor(quantity));
    const effectiveDiscountPercent = getEffectiveDiscountPercent({
      discountPercent: product.discount_percent,
      discountStartAt: product.discount_start_at,
      discountEndAt: product.discount_end_at,
    });
    const normalizedProduct: Product = {
      ...product,
      price: calculateDiscountedPrice(product.price, effectiveDiscountPercent),
    };

    setCart((prev) => {
      const existing = prev.find(
        (item) => item.product.id === normalizedProduct.id,
      );
      if (existing) {
        return prev.map((item) =>
          item.product.id === normalizedProduct.id
            ? { ...item, quantity: item.quantity + safeQuantity }
            : item,
        );
      }
      return [...prev, { product: normalizedProduct, quantity: safeQuantity }];
    });

    trackAddToCart(normalizedProduct, safeQuantity);
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const existing = cart.find((item) => item.product.id === productId);

    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart((prev) =>
      prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item,
      ),
    );

    if (existing) {
      const delta = quantity - existing.quantity;
      if (delta > 0) {
        trackAddToCart(existing.product, delta);
      } else if (delta < 0) {
        trackRemoveFromCart(existing.product, Math.abs(delta));
      }
    }
  };

  const removeFromCart = (productId: string) => {
    const existing = cart.find((item) => item.product.id === productId);
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
    if (existing) {
      trackRemoveFromCart(existing.product, existing.quantity);
    }
  };

  const clearCart = () => {
    setCart([]);
  };

  const getTotalItems = () => {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  };

  const getTotalPrice = () => {
    return cart.reduce(
      (sum, item) => sum + item.product.price * item.quantity,
      0,
    );
  };

  return {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    clearCart,
    getTotalItems,
    getTotalPrice,
    isLoaded,
  };
}
