"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Button,
  Card,
  InputNumber,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { ArrowLeftOutlined, ShoppingCartOutlined } from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import { calculateDiscountedPrice, formatCurrency } from "@/lib/utils";
import type { Product } from "@/types/database";

interface ProductMedia {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  media_type: "image" | "video";
}

const { Paragraph } = Typography;

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [mediaItems, setMediaItems] = useState<ProductMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const {
    cart,
    addToCart,
    updateQuantity,
    removeFromCart,
    getTotalItems,
    getTotalPrice,
    isLoaded,
  } = useCart();

  const productId = String(params.id || "");

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        const [productsRes, mediaRes] = await Promise.all([
          fetch("/api/products?activeOnly=true"),
          fetch(`/api/products/${productId}/media`),
        ]);

        if (!productsRes.ok) {
          throw new Error("Không thể tải sản phẩm");
        }

        const products = (await productsRes.json()) as Product[];
        const foundProduct =
          products.find((item) => item.id === productId) || null;
        setProduct(foundProduct);

        if (foundProduct) {
          const related = products
            .filter(
              (item) =>
                item.id !== foundProduct.id &&
                item.category === foundProduct.category,
            )
            .slice(0, 4);
          setRelatedProducts(related);
          setQuantity(1);
        } else {
          setRelatedProducts([]);
        }

        if (mediaRes.ok) {
          const media = (await mediaRes.json()) as ProductMedia[];
          setMediaItems(media);
          setActiveMediaIndex(0);
        } else {
          setMediaItems([]);
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : "Không thể tải chi tiết sản phẩm";
        messageApi.error(errorMessage);
      } finally {
        setIsLoading(false);
      }
    };

    if (productId) {
      fetchDetail();
    }
  }, [productId, messageApi]);

  const categoryNames = useMemo(() => {
    if (!product) return [];
    if (product.categories && product.categories.length > 0) {
      return product.categories.map((item) => item.name);
    }
    return [product.category];
  }, [product]);

  const handleAddToCart = () => {
    if (!product) return;
    const maxAllowed = Math.max(1, product.stock_quantity);
    const safeQuantity = Math.min(Math.max(1, quantity), maxAllowed);
    addToCart(product, safeQuantity);
    messageApi.success(`Đã thêm ${safeQuantity} sản phẩm vào giỏ hàng`);
  };

  const handleCheckout = () => {
    setIsCartOpen(false);
    router.push("/checkout");
  };

  if (isLoading || !isLoaded) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Đang tải chi tiết sản phẩm...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50">
        {contextHolder}
        <Header
          cartItemsCount={getTotalItems()}
          onCartClick={() => setIsCartOpen(true)}
        />
        <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
            <Space direction="vertical" size={16}>
              <div className="text-lg font-semibold">
                Không tìm thấy sản phẩm
              </div>
              <Button
                icon={<ArrowLeftOutlined />}
                onClick={() => router.push("/")}
              >
                Quay về trang chủ
              </Button>
            </Space>
          </Card>
        </main>
      </div>
    );
  }

  const isOutOfStock = product.stock_quantity <= 0;
  const activeMedia = mediaItems[activeMediaIndex];
  const fallbackMediaUrl = product.image_url || null;
  const discountPercent = product.discount_percent || 0;
  const hasDiscount = discountPercent > 0;
  const finalPrice = calculateDiscountedPrice(product.price, discountPercent);
  const savingAmount = product.price - finalPrice;

  return (
    <div className="min-h-screen bg-gray-50">
      {contextHolder}

      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <Button icon={<ArrowLeftOutlined />} onClick={() => router.push("/")}>
          Quay lại
        </Button>

        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-3">
              <div className="bg-gray-100 rounded-lg overflow-hidden aspect-square">
                {activeMedia ? (
                  activeMedia.media_type === "video" ? (
                    <video
                      src={activeMedia.image_url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <img
                      src={activeMedia.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  )
                ) : fallbackMediaUrl ? (
                  <img
                    src={fallbackMediaUrl}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400">
                    📦
                  </div>
                )}
              </div>

              {mediaItems.length > 0 && (
                <div className="grid grid-cols-5 gap-2">
                  {mediaItems.map((media, index) => (
                    <button
                      key={media.id}
                      onClick={() => setActiveMediaIndex(index)}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-square ${
                        index === activeMediaIndex
                          ? "border-blue-600"
                          : "border-transparent"
                      }`}
                    >
                      {media.media_type === "video" ? (
                        <video
                          src={media.image_url}
                          className="w-full h-full object-cover"
                          muted
                        />
                      ) : (
                        <img
                          src={media.image_url}
                          alt={`${product.name}-${index + 1}`}
                          className="w-full h-full object-cover"
                        />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  {categoryNames.map((category) => (
                    <Tag key={category} color="blue">
                      {category}
                    </Tag>
                  ))}
                </div>

                <h1 className="text-3xl font-bold text-gray-900">
                  {product.name}
                </h1>

                <div className="space-y-2">
                  <div className="text-4xl font-extrabold text-red-600 leading-none">
                    {formatCurrency(finalPrice)}
                  </div>
                  {hasDiscount && (
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-lg text-gray-500 line-through">
                        {formatCurrency(product.price)}
                      </span>
                      <Tag color="red" style={{ marginInlineStart: 0 }}>
                        Giảm {discountPercent}%
                      </Tag>
                      <span className="text-sm font-semibold text-red-500">
                        Tiết kiệm {formatCurrency(savingAmount)}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="text-sm text-gray-600">
                Tồn kho:{" "}
                <strong>
                  {isOutOfStock ? "Hết hàng" : product.stock_quantity}
                </strong>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-700">Số lượng:</span>
                <InputNumber
                  min={1}
                  max={Math.max(1, product.stock_quantity)}
                  value={quantity}
                  onChange={(value) => setQuantity(Number(value || 1))}
                  disabled={isOutOfStock}
                />
              </div>

              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                disabled={isOutOfStock}
                onClick={handleAddToCart}
              >
                Thêm vào giỏ hàng
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Mô tả sản phẩm">
          {product.description ? (
            <Paragraph
              style={{
                whiteSpace: "pre-wrap",
                lineHeight: 1.8,
                marginBottom: 0,
              }}
            >
              {product.description}
            </Paragraph>
          ) : (
            <div className="text-gray-500">
              Sản phẩm chưa có mô tả chi tiết.
            </div>
          )}
        </Card>

        {relatedProducts.length > 0 && (
          <Card title="Sản phẩm liên quan">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {relatedProducts.map((item) => (
                <button
                  key={item.id}
                  onClick={() => router.push(`/products/${item.id}`)}
                  className="text-left border rounded-lg overflow-hidden hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <div className="aspect-square bg-gray-100">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400 text-3xl">
                        📦
                      </div>
                    )}
                  </div>

                  <div className="p-3 space-y-1">
                    <div className="font-medium text-sm text-gray-900 line-clamp-2 min-h-10">
                      {item.name}
                    </div>
                    <div className="font-semibold text-blue-600">
                      {formatCurrency(
                        calculateDiscountedPrice(
                          item.price,
                          item.discount_percent,
                        ),
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </Card>
        )}
      </main>

      <CartModal
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeFromCart}
        onCheckout={handleCheckout}
        totalPrice={getTotalPrice()}
      />
    </div>
  );
}
