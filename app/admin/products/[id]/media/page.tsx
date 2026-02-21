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
  media_type?: "image" | "video";
}

interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
}

interface MediaFolder {
  name: string;
  path: string;
}

interface MediaListResponse {
  currentPath: string;
  parentPath: string | null;
  folders: MediaFolder[];
  files: MediaFile[];
}

function isVideoFile(file: {
  mimeType?: string | null;
  url?: string;
}): boolean {
  if (file.mimeType?.startsWith("video/")) return true;
  const normalizedUrl = (file.url || "").toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(normalizedUrl);
}

export default function ProductMediaPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [libraryPath, setLibraryPath] = useState("");
  const [libraryParentPath, setLibraryParentPath] = useState<string | null>(
    null,
  );
  const [libraryFolders, setLibraryFolders] = useState<MediaFolder[]>([]);
  const [libraryFiles, setLibraryFiles] = useState<MediaFile[]>([]);
  const [librarySearch, setLibrarySearch] = useState("");
  const [isLibraryLoading, setIsLibraryLoading] = useState(false);
  const [attachingPath, setAttachingPath] = useState<string | null>(null);

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

  const fetchLibrary = async (targetPath = "") => {
    setIsLibraryLoading(true);
    try {
      const query = targetPath ? `?path=${encodeURIComponent(targetPath)}` : "";
      const response = await fetch(`/api/admin/media${query}`);
      const result = (await response.json()) as MediaListResponse & {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải thư viện media");
      }

      setLibraryPath(result.currentPath || "");
      setLibraryParentPath(result.parentPath || null);
      setLibraryFolders(result.folders || []);
      setLibraryFiles(result.files || []);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể tải thư viện media";
      alert(`❌ ${message}`);
    } finally {
      setIsLibraryLoading(false);
    }
  };

  const openLibraryPicker = async () => {
    setIsLibraryOpen(true);
    setLibrarySearch("");
    await fetchLibrary("");
  };

  const attachFromLibrary = async (file: MediaFile) => {
    setAttachingPath(file.path);
    try {
      const formData = new FormData();
      formData.append("productId", productId);
      formData.append("source", "library");
      formData.append("mediaUrl", file.url);
      formData.append("storagePath", file.path);
      formData.append("isCover", images.length === 0 ? "true" : "false");

      const response = await fetch("/api/admin/product-images", {
        method: "POST",
        body: formData,
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể gắn media");
      }

      await fetchData();
      alert("✅ Đã gắn media vào sản phẩm");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Không thể gắn media";
      alert(`❌ ${message}`);
    } finally {
      setAttachingPath(null);
    }
  };

  const filteredLibraryFolders = libraryFolders.filter((folder) =>
    folder.name.toLowerCase().includes(librarySearch.toLowerCase()),
  );
  const filteredLibraryFiles = libraryFiles.filter((file) =>
    file.name.toLowerCase().includes(librarySearch.toLowerCase()),
  );

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
                <div className="p-3 bg-linear-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
                  <ImageIcon className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    Quản lý Media
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
                Upload Media Mới
              </h2>
              <ImageUpload
                productId={productId}
                onUploadSuccess={handleRefresh}
                maxFiles={10}
              />

              <button
                onClick={openLibraryPicker}
                className="mt-4 w-full px-4 py-2 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
              >
                Chọn nhanh từ Thư viện media
              </button>
            </div>
          </div>

          {/* Right: Gallery */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
              <ImageGallery images={images} onImagesChange={handleRefresh} />
            </div>
          </div>
        </div>
      </div>

      {isLibraryOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-6xl max-h-[90vh] overflow-hidden bg-white rounded-xl shadow-2xl flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Chọn media từ thư viện
                </h3>
                <p className="text-sm text-gray-500">
                  Click vào file để gắn vào sản phẩm
                </p>
              </div>
              <button
                onClick={() => setIsLibraryOpen(false)}
                className="px-3 py-1.5 text-sm border border-gray-300 hover:bg-gray-50 rounded-lg"
              >
                Đóng
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-100 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <button
                  onClick={() => fetchLibrary("")}
                  className="text-blue-600 hover:text-blue-700"
                >
                  Media
                </button>
                {libraryPath
                  .split("/")
                  .filter(Boolean)
                  .map((segment, index, allSegments) => {
                    const path = allSegments.slice(0, index + 1).join("/");
                    return (
                      <span key={path} className="flex items-center gap-2">
                        <span>/</span>
                        <button
                          onClick={() => fetchLibrary(path)}
                          className="text-blue-600 hover:text-blue-700"
                        >
                          {segment}
                        </button>
                      </span>
                    );
                  })}
              </div>

              <div className="flex items-center gap-3">
                <input
                  value={librarySearch}
                  onChange={(event) => setLibrarySearch(event.target.value)}
                  placeholder="Tìm folder / file..."
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                {libraryParentPath && (
                  <button
                    onClick={() => fetchLibrary(libraryParentPath)}
                    className="px-3 py-2 text-sm border border-gray-300 hover:bg-gray-50 rounded-lg"
                  >
                    Lên thư mục cha
                  </button>
                )}
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              {isLibraryLoading ? (
                <div className="py-16 text-center text-gray-500">
                  Đang tải...
                </div>
              ) : (
                <div className="space-y-6">
                  {filteredLibraryFolders.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-700 mb-3">
                        Folders
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
                        {filteredLibraryFolders.map((folder) => (
                          <button
                            key={folder.path}
                            onClick={() => fetchLibrary(folder.path)}
                            className="text-left border border-gray-200 rounded-lg p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="text-2xl">📁</div>
                            <div className="text-sm font-medium text-gray-800 truncate mt-1">
                              {folder.name}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Files
                    </h4>
                    {filteredLibraryFiles.length === 0 ? (
                      <div className="py-12 text-center text-gray-500 border border-dashed border-gray-300 rounded-lg">
                        Không có file phù hợp
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {filteredLibraryFiles.map((file) => {
                          const isVideo = isVideoFile({
                            mimeType: file.mimeType,
                            url: file.url,
                          });

                          return (
                            <button
                              key={file.path}
                              onClick={() => attachFromLibrary(file)}
                              disabled={attachingPath === file.path}
                              className="text-left border border-gray-200 rounded-lg p-2 hover:border-blue-300 hover:shadow-sm transition-all disabled:opacity-60"
                            >
                              <div className="aspect-square rounded-md bg-gray-100 overflow-hidden relative">
                                {isVideo ? (
                                  <video
                                    src={file.url}
                                    className="w-full h-full object-cover"
                                    muted
                                  />
                                ) : (
                                  <img
                                    src={file.url}
                                    alt={file.name}
                                    className="w-full h-full object-cover"
                                  />
                                )}
                                {isVideo && (
                                  <span className="absolute bottom-2 left-2 text-[10px] px-2 py-1 rounded-full bg-black/65 text-white">
                                    VIDEO
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 text-xs text-gray-800 truncate">
                                {file.name}
                              </div>
                              <div className="text-[11px] text-gray-500 truncate">
                                {attachingPath === file.path
                                  ? "Đang gắn..."
                                  : "Click để gắn vào sản phẩm"}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
