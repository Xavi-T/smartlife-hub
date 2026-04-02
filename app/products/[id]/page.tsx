"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useParams, useRouter } from "next/navigation";
import DOMPurify from "dompurify";
import {
  Button,
  Card,
  Carousel,
  InputNumber,
  Modal,
  Space,
  Tag,
  message,
} from "antd";
import type { CarouselRef } from "antd/es/carousel";
import {
  ArrowLeftOutlined,
  SafetyCertificateOutlined,
  LeftOutlined,
  RightOutlined,
  ShoppingCartOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { Header } from "@/components/home/Header";
import { CartModal } from "@/components/home/CartModal";
import { useCart } from "@/hooks/useCart";
import {
  calculateDiscountedPrice,
  formatCurrency,
  formatRemainingTime,
  getEffectiveDiscountPercent,
} from "@/lib/utils";
import type { Product } from "@/types/database";
import {
  trackBeginCheckout,
  trackSelectItem,
  trackViewItem,
} from "@/lib/analytics";

interface ProductMedia {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  width: number | null;
  height: number | null;
  media_type: "image" | "video";
}

interface ProductVariant {
  id: string;
  variant_name: string;
  price: number;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [messageApi, contextHolder] = message.useMessage();
  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [mediaItems, setMediaItems] = useState<ProductMedia[]>([]);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0);
  const [selectedVariantId, setSelectedVariantId] = useState<string | null>(
    null,
  );
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const carouselRef = useRef<CarouselRef | null>(null);

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
          const variants = Array.isArray(foundProduct.variants)
            ? (foundProduct.variants as ProductVariant[])
            : [];
          const activeVariants = variants.filter(
            (item) => item.is_active !== false,
          );
          setSelectedVariantId(activeVariants[0]?.id || null);
        } else {
          setRelatedProducts([]);
          setSelectedVariantId(null);
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

  useEffect(() => {
    if (
      !product ||
      Number(product.discount_percent || 0) <= 0 ||
      (!product.discount_start_at && !product.discount_end_at)
    ) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [product]);

  useEffect(() => {
    if (!product) return;
    trackViewItem(product);
  }, [product]);

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
    const selectedVariant = activeVariants.find(
      (item) => item.id === selectedVariantId,
    );
    const productForCart =
      selectedVariant && selectedVariant.price >= 0
        ? {
            ...product,
            id: `${product.id}::${selectedVariant.id}`,
            name: `${product.name} - ${selectedVariant.variant_name}`,
            price: Number(selectedVariant.price || product.price),
            image_url: selectedVariant.image_url || product.image_url,
          }
        : product;

    addToCart(productForCart, safeQuantity);
    messageApi.success(`Đã thêm ${safeQuantity} sản phẩm vào giỏ hàng`);
  };

  const handleCheckout = () => {
    trackBeginCheckout(cart);
    setIsCartOpen(false);
    router.push("/checkout");
  };

  const handleBuyNow = () => {
    if (!product) return;
    const maxAllowed = Math.max(1, product.stock_quantity);
    const safeQuantity = Math.min(Math.max(1, quantity), maxAllowed);
    const selectedVariant = activeVariants.find(
      (item) => item.id === selectedVariantId,
    );
    const productForCart =
      selectedVariant && selectedVariant.price >= 0
        ? {
            ...product,
            id: `${product.id}::${selectedVariant.id}`,
            name: `${product.name} - ${selectedVariant.variant_name}`,
            price: Number(selectedVariant.price || product.price),
            image_url: selectedVariant.image_url || product.image_url,
          }
        : product;

    addToCart(productForCart, safeQuantity);
    router.push("/checkout");
  };

  const activeVariants = useMemo(
    () =>
      Array.isArray(product?.variants)
        ? (product.variants as ProductVariant[]).filter(
            (item) => item.is_active !== false,
          )
        : [],
    [product?.variants],
  );
  const selectedVariant = useMemo(
    () => activeVariants.find((item) => item.id === selectedVariantId),
    [activeVariants, selectedVariantId],
  );
  const displayMediaItems = useMemo(() => {
    const existing = [...mediaItems];
    const variantImage = selectedVariant?.image_url?.trim() || "";
    if (
      variantImage &&
      !existing.some((item) => item.image_url === variantImage)
    ) {
      return [
        {
          id: `variant-${selectedVariant?.id || "image"}`,
          image_url: variantImage,
          display_order: 0,
          is_cover: true,
          width: null,
          height: null,
          media_type: "image" as const,
        },
        ...existing,
      ];
    }
    return existing;
  }, [mediaItems, selectedVariant?.id, selectedVariant?.image_url]);
  const activeMedia = displayMediaItems[activeMediaIndex];
  const visibleThumbCount = 5;
  const visibleThumbItems = displayMediaItems.slice(
    thumbnailStartIndex,
    thumbnailStartIndex + visibleThumbCount,
  );
  const canShowPrevThumb = activeMediaIndex > 0;
  const canShowNextThumb = activeMediaIndex < displayMediaItems.length - 1;

  useEffect(() => {
    const variantImage = selectedVariant?.image_url?.trim() || "";
    const variantImageIndex = variantImage
      ? displayMediaItems.findIndex((item) => item.image_url === variantImage)
      : -1;
    const nextIndex = variantImageIndex >= 0 ? variantImageIndex : 0;

    setActiveMediaIndex(nextIndex);
    setThumbnailStartIndex(0);
    carouselRef.current?.goTo?.(nextIndex, false);
  }, [selectedVariantId, selectedVariant?.image_url, displayMediaItems]);

  useEffect(() => {
    if (activeMediaIndex < thumbnailStartIndex) {
      setThumbnailStartIndex(activeMediaIndex);
      return;
    }

    if (activeMediaIndex >= thumbnailStartIndex + visibleThumbCount) {
      setThumbnailStartIndex(
        Math.max(0, activeMediaIndex - visibleThumbCount + 1),
      );
    }
  }, [activeMediaIndex, thumbnailStartIndex]);

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
            <Space orientation="vertical" size={16}>
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
  const fallbackMediaUrl =
    selectedVariant?.image_url || product.image_url || null;
  const discountPercent = getEffectiveDiscountPercent({
    discountPercent: product.discount_percent,
    discountStartAt: product.discount_start_at,
    discountEndAt: product.discount_end_at,
    nowMs,
  });
  const hasDiscount = discountPercent > 0;
  const basePrice = Number(selectedVariant?.price || product.price);
  const finalPrice = calculateDiscountedPrice(basePrice, discountPercent);
  const savingAmount = basePrice - finalPrice;
  const discountEndMs = product.discount_end_at
    ? Date.parse(product.discount_end_at)
    : NaN;
  const hasValidDiscountEnd = Number.isFinite(discountEndMs);
  const remainingDiscountMs = hasValidDiscountEnd
    ? Math.max(0, discountEndMs - nowMs)
    : 0;
  const openImagePreview = (imageUrl: string | null | undefined) => {
    if (!imageUrl) return;
    setPreviewImageUrl(imageUrl);
  };
  const sanitizedDescription = DOMPurify.sanitize(product.description || "", {
    USE_PROFILES: { html: true },
  });

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      {contextHolder}

      <Header
        cartItemsCount={getTotalItems()}
        onCartClick={() => setIsCartOpen(true)}
      />

      <main className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-6 overflow-x-hidden">
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => router.push("/")}
          className="w-full sm:w-auto"
        >
          Quay lại
        </Button>

        <Card>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
            <div className="space-y-2 sm:space-y-3">
              <div className="relative bg-gray-100 rounded-lg overflow-hidden aspect-square">
                {displayMediaItems.length > 1 ? (
                  <Carousel
                    ref={carouselRef}
                    dots
                    autoplay={displayMediaItems.length > 1}
                    autoplaySpeed={3200}
                    infinite
                    afterChange={(index) => setActiveMediaIndex(index)}
                    className="w-full h-full"
                  >
                    {displayMediaItems.map((media) => (
                      <div
                        key={media.id}
                        className="relative w-full aspect-square"
                      >
                        {media.media_type === "video" ? (
                          <video
                            src={media.image_url}
                            className="w-full h-full object-cover"
                            controls
                          />
                        ) : (
                          <Image
                            src={media.image_url}
                            alt={product.name}
                            fill
                            sizes="(max-width: 1024px) 100vw, 50vw"
                            className="w-full h-full object-cover"
                            onClick={() => openImagePreview(media.image_url)}
                            style={{ cursor: "zoom-in" }}
                          />
                        )}
                      </div>
                    ))}
                  </Carousel>
                ) : activeMedia ? (
                  activeMedia.media_type === "video" ? (
                    <video
                      src={activeMedia.image_url}
                      className="w-full h-full object-cover"
                      controls
                    />
                  ) : (
                    <Image
                      src={activeMedia.image_url}
                      alt={product.name}
                      fill
                      sizes="(max-width: 1024px) 100vw, 50vw"
                      className="w-full h-full object-cover"
                      onClick={() => openImagePreview(activeMedia.image_url)}
                      style={{ cursor: "zoom-in" }}
                    />
                  )
                ) : fallbackMediaUrl ? (
                  <Image
                    src={fallbackMediaUrl}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 50vw"
                    className="w-full h-full object-cover"
                    onClick={() => openImagePreview(fallbackMediaUrl)}
                    style={{ cursor: "zoom-in" }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-5xl text-gray-400">
                    📦
                  </div>
                )}
              </div>

              {displayMediaItems.length > 0 && (
                <div className="flex items-center gap-2 w-full max-w-full">
                  <Button
                    shape="circle"
                    icon={<LeftOutlined />}
                    size="small"
                    className="shrink-0"
                    onClick={() => {
                      const nextIndex = Math.max(0, activeMediaIndex - 1);
                      setActiveMediaIndex(nextIndex);
                      carouselRef.current?.goTo?.(nextIndex, false);
                    }}
                    disabled={!canShowPrevThumb}
                    aria-label="Ảnh trước"
                  />
                  <div className="flex-1 min-w-0 max-w-full flex items-center gap-1.5 sm:gap-2 overflow-hidden">
                    {visibleThumbItems.map((media, index) => {
                      const absoluteIndex = thumbnailStartIndex + index;
                      const isActive = absoluteIndex === activeMediaIndex;
                      return (
                        <button
                          key={`${media.id}-${absoluteIndex}`}
                          onClick={() => {
                            setActiveMediaIndex(absoluteIndex);
                            carouselRef.current?.goTo?.(absoluteIndex, false);
                          }}
                          className={`relative rounded-lg overflow-hidden border-2 aspect-square shrink-0 w-14 sm:w-16 md:w-21 ${
                            isActive ? "border-blue-600" : "border-transparent"
                          }`}
                        >
                          {media.media_type === "video" ? (
                            <video
                              src={media.image_url}
                              className="w-full h-full object-cover"
                              muted
                            />
                          ) : (
                            <Image
                              src={media.image_url}
                              alt={`${product.name}-${absoluteIndex + 1}`}
                              fill
                              sizes="84px"
                              className="w-full h-full object-cover"
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    shape="circle"
                    icon={<RightOutlined />}
                    size="small"
                    className="shrink-0"
                    onClick={() => {
                      const nextIndex = Math.min(
                        displayMediaItems.length - 1,
                        activeMediaIndex + 1,
                      );
                      setActiveMediaIndex(nextIndex);
                      carouselRef.current?.goTo?.(nextIndex, false);
                    }}
                    disabled={!canShowNextThumb}
                    aria-label="Ảnh tiếp theo"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4 sm:space-y-5">
              <div className="space-y-2 sm:space-y-3">
                <div className="flex flex-wrap gap-2">
                  {categoryNames.map((category) => (
                    <Tag key={category} color="blue">
                      {category}
                    </Tag>
                  ))}
                </div>

                <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 leading-snug">
                  {product.name}
                </h1>

                <div className="space-y-2">
                  <div className="text-[26px] sm:text-3xl md:text-4xl font-extrabold text-red-600 leading-none">
                    {formatCurrency(finalPrice)}
                  </div>
                  {activeVariants.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-sm font-semibold text-gray-700 tracking-wide">
                        PHÂN LOẠI
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {activeVariants.map((variant) => {
                          const isSelected = selectedVariantId === variant.id;
                          return (
                            <button
                              key={variant.id}
                              type="button"
                              onClick={() => setSelectedVariantId(variant.id)}
                              className={`w-full rounded-lg border px-2.5 py-2 text-left transition-all ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 shadow-sm"
                                  : "border-gray-200 bg-white hover:border-blue-300"
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-9 h-9 rounded overflow-hidden bg-gray-100 shrink-0">
                                  {variant.image_url ? (
                                    <Image
                                      src={variant.image_url}
                                      alt={variant.variant_name}
                                      width={36}
                                      height={36}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-full h-full grid place-items-center text-gray-400 text-xs">
                                      Ảnh
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-semibold text-gray-800 text-sm sm:text-base leading-tight line-clamp-2">
                                    {variant.variant_name}
                                  </div>
                                  <div className="text-[12px] text-gray-500">
                                    {formatCurrency(variant.price)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  {hasDiscount && (
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-base sm:text-lg text-gray-500 line-through">
                        {formatCurrency(basePrice)}
                      </span>
                      <Tag color="red" style={{ marginInlineStart: 0 }}>
                        Giảm {discountPercent}%
                      </Tag>
                      <span className="text-xs sm:text-sm font-semibold text-red-500">
                        Tiết kiệm {formatCurrency(savingAmount)}
                      </span>
                    </div>
                  )}

                  {hasDiscount &&
                    hasValidDiscountEnd &&
                    remainingDiscountMs > 0 && (
                      <div className="text-xs sm:text-sm font-medium text-orange-600">
                        Kết thúc giảm giá sau:{" "}
                        {formatRemainingTime(remainingDiscountMs)}
                      </div>
                    )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="text-sm text-gray-700 min-w-17">
                  Số lượng:
                </span>
                <InputNumber
                  min={1}
                  max={Math.max(1, product.stock_quantity)}
                  value={quantity}
                  onChange={(value) => setQuantity(Number(value || 1))}
                  disabled={isOutOfStock}
                  style={{ width: 120 }}
                />
              </div>
              <Tag
                color="green"
                icon={<SafetyCertificateOutlined />}
                style={{
                  marginInlineStart: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  paddingInline: 10,
                  paddingBlock: 5,
                  borderRadius: 8,
                }}
              >
                Miễn phí 15 ngày đổi trả sản phẩm
              </Tag>
              <Tag
                color="geekblue"
                icon={<SafetyCertificateOutlined />}
                style={{
                  marginInlineStart: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  paddingInline: 10,
                  paddingBlock: 5,
                  borderRadius: 8,
                  marginTop: 10,
                }}
              >
                Bảo hành sản phẩm 3 tháng
              </Tag>{" "}
              <br />
              <Tag
                color="blue"
                icon={<TruckOutlined />}
                style={{
                  marginInlineStart: 0,
                  fontSize: 14,
                  fontWeight: 600,
                  paddingInline: 10,
                  paddingBlock: 5,
                  borderRadius: 8,
                  marginTop: 10,
                }}
              >
                Miễn phí vận chuyển toàn quốc
              </Tag>
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3">
                <Button
                  type="primary"
                  size="large"
                  icon={<ShoppingCartOutlined />}
                  disabled={isOutOfStock}
                  onClick={handleAddToCart}
                  className="w-full sm:w-auto"
                >
                  Thêm vào giỏ hàng
                </Button>
                <Button
                  size="large"
                  disabled={isOutOfStock}
                  onClick={handleBuyNow}
                  className="w-full sm:w-auto"
                >
                  Mua ngay
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <Card title="Mô tả sản phẩm">
          {sanitizedDescription ? (
            <div
              style={{ lineHeight: 1.8, marginBottom: 0 }}
              className="[&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_a]:text-blue-600 [&_a]:underline [&_.sl-rte-image-wrapper]:max-w-full"
              dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
            />
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
                  onClick={() => {
                    trackSelectItem(item, "related_products");
                    router.push(`/products/${item.id}`);
                  }}
                  className="text-left border rounded-lg overflow-hidden hover:border-blue-400 hover:shadow-sm transition-all"
                >
                  <div className="aspect-square bg-gray-100">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        width={480}
                        height={480}
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
                          getEffectiveDiscountPercent({
                            discountPercent: item.discount_percent,
                            discountStartAt: item.discount_start_at,
                            discountEndAt: item.discount_end_at,
                          }),
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

      <Modal
        open={Boolean(previewImageUrl)}
        footer={null}
        onCancel={() => setPreviewImageUrl(null)}
        width="min(92vw, 960px)"
        centered
        destroyOnHidden
      >
        {previewImageUrl && (
          <Image
            src={previewImageUrl}
            alt={product.name}
            width={1400}
            height={1000}
            style={{
              width: "100%",
              maxHeight: "80vh",
              objectFit: "contain",
              borderRadius: 8,
            }}
          />
        )}
      </Modal>
    </div>
  );
}
