"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, RefreshCw, Image as ImageIcon } from "lucide-react";
import { ImageUpload } from "@/components/admin/ImageUpload";
import { ImageGallery } from "@/components/admin/ImageGallery";
import type { Product } from "@/types/database";

interface ProductImage {
  id: string;
  image_url: string;
  display_order: number;
  is_cover: boolean;
  file_size: number | null;
  width: number | null;
  height: number | null;
}

export default function ProductMediaPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      // Fetch product info
      const productRes = await fetch("/api/products");
      const products = await productRes.json();
      const foundProduct = products.find((p: Product) => p.id === productId);
      setProduct(foundProduct || null);

      // Fetch images
      const imagesRes = await fetch(
        `/api/admin/product-images?productId=${productId}`,
      );
      if (imagesRes.ok) {
        const imagesData = await imagesRes.json();
        setImages(imagesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [productId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchData();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Không tìm thấy sản phẩm</p>
          <button
            onClick={() => router.push("/admin/products")}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>

              <div className="flex items-center gap-3">
                <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Quản lý Ảnh
                  </h1>
                  <p className="text-sm text-gray-500">{product.name}</p>
                </div>
              </div>
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              Làm mới
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left: Upload */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 sticky top-8">
              <h2 className="text-lg font-bold text-gray-900 mb-4">
                Upload Ảnh Mới
              </h2>
              <ImageUpload
                productId={productId}
                onUploadSuccess={handleRefresh}
                maxFiles={10}
              />
            </div>
          </div>

          {/* Right: Gallery */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <ImageGallery
                productId={productId}
                images={images}
                onImagesChange={handleRefresh}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
