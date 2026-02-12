"use client";
import { useState, useEffect, useRef } from "react";
import {
  Menu,
  Search,
  Plus,
  ShoppingCart,
  Package,
  X,
  Phone,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface AdminHeaderProps {
  onMenuClick: () => void;
  onQuickOrder: () => void;
  onQuickStockInbound: () => void;
}

interface SearchResult {
  type: "product" | "customer";
  id: string;
  title: string;
  subtitle: string;
  href: string;
}

export function AdminHeader({
  onMenuClick,
  onQuickOrder,
  onQuickStockInbound,
}: AdminHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Global search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearching(true);
      try {
        const results: SearchResult[] = [];

        // Search products
        const productsRes = await fetch("/api/products");
        if (productsRes.ok) {
          const products = await productsRes.json();
          const matchedProducts = products
            .filter((p: any) =>
              p.name.toLowerCase().includes(searchQuery.toLowerCase()),
            )
            .slice(0, 3)
            .map((p: any) => ({
              type: "product" as const,
              id: p.id,
              title: p.name,
              subtitle: `${p.category} - ${p.stock_quantity} trong kho`,
              href: `/admin/inventory?search=${p.name}`,
            }));
          results.push(...matchedProducts);
        }

        // Search customers by phone
        const customersRes = await fetch(
          `/api/admin/customers?search=${searchQuery}`,
        );
        if (customersRes.ok) {
          const { customers } = await customersRes.json();
          const matchedCustomers = customers.slice(0, 3).map((c: any) => ({
            type: "customer" as const,
            id: c.phone,
            title: c.name,
            subtitle: `${c.phone} - ${c.totalOrders} đơn hàng`,
            href: `/admin/customers?search=${c.phone}`,
          }));
          results.push(...matchedCustomers);
        }

        setSearchResults(results);
        setShowResults(true);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  // Close search results when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleResultClick = (href: string) => {
    router.push(href);
    setSearchQuery("");
    setShowResults(false);
  };

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 lg:px-6 sticky top-0 z-30">
      {/* Left: Menu button + Search */}
      <div className="flex items-center gap-4 flex-1">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <Menu className="w-5 h-5 text-gray-600" />
        </button>

        {/* Global Search */}
        <div className="relative flex-1 max-w-xl" ref={searchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowResults(true)}
              placeholder="Tìm sản phẩm, khách hàng..."
              className="w-full pl-10 pr-10 py-2 border-2 border-gray-400 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm text-gray-900 placeholder:text-gray-600 font-medium"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setSearchResults([]);
                  setShowResults(false);
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-4 h-4 text-gray-600" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50">
              {searchResults.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}-${index}`}
                  onClick={() => handleResultClick(result.href)}
                  className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 text-left"
                >
                  <div
                    className={`p-2 rounded-lg ${
                      result.type === "product" ? "bg-blue-50" : "bg-green-50"
                    }`}
                  >
                    {result.type === "product" ? (
                      <Package className="w-5 h-5 text-blue-600" />
                    ) : (
                      <User className="w-5 h-5 text-green-600" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">
                      {result.title}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {result.subtitle}
                    </p>
                  </div>
                  <span
                    className={`text-xs font-medium px-2 py-1 rounded ${
                      result.type === "product"
                        ? "bg-blue-50 text-blue-700"
                        : "bg-green-50 text-green-700"
                    }`}
                  >
                    {result.type === "product" ? "Sản phẩm" : "Khách hàng"}
                  </span>
                </button>
              ))}
            </div>
          )}

          {showResults &&
            searchQuery &&
            searchResults.length === 0 &&
            !isSearching && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl p-4 text-center z-50">
                <p className="text-sm text-gray-500">Không tìm thấy kết quả</p>
              </div>
            )}
        </div>
      </div>

      {/* Right: Quick Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={onQuickOrder}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm hover:shadow-md"
        >
          <ShoppingCart className="w-4 h-4" />
          <span className="text-sm font-medium">Tạo đơn</span>
        </button>

        <button
          onClick={onQuickStockInbound}
          className="hidden sm:flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Package className="w-4 h-4" />
          <span className="text-sm font-medium">Nhập kho</span>
        </button>

        {/* Mobile Quick Actions */}
        <button
          onClick={onQuickOrder}
          className="sm:hidden p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Tạo đơn hàng"
        >
          <ShoppingCart className="w-5 h-5" />
        </button>

        <button
          onClick={onQuickStockInbound}
          className="sm:hidden p-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          title="Nhập kho"
        >
          <Package className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
