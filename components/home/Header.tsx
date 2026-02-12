"use client";

import { ShoppingCart } from "lucide-react";

interface HeaderProps {
  cartItemsCount: number;
  onCartClick: () => void;
}

export function Header({ cartItemsCount, onCartClick }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xl">SL</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">SmartLife Hub</h1>
              <p className="text-xs text-gray-500">Đồ gia dụng chất lượng</p>
            </div>
          </div>

          <button
            onClick={onCartClick}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Giỏ hàng"
          >
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {cartItemsCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemsCount > 9 ? "9+" : cartItemsCount}
              </span>
            )}
          </button>
        </div>
      </div>
    </header>
  );
}
