"use client";

import { useState, useCallback, useRef } from "react";
import {
  Upload,
  X,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";
import {
  compressImage,
  validateImageFile,
  getImageDimensions,
  formatFileSize,
} from "@/lib/imageUtils";

interface ImageUploadProps {
  productId: string;
  onUploadSuccess: () => void;
  maxFiles?: number;
}

interface UploadingFile {
  file: File;
  progress: number;
  status: "compressing" | "uploading" | "done" | "error";
  error?: string;
  preview: string;
  originalSize: number;
  compressedSize?: number;
  mediaType: "image" | "video";
}

function getMediaType(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  return null;
}

function validateMediaFile(file: File): { valid: boolean; error?: string } {
  const mediaType = getMediaType(file);
  if (!mediaType) {
    return {
      valid: false,
      error: "Chỉ hỗ trợ ảnh hoặc video (JPG, PNG, WEBP, MP4, MOV, WEBM)",
    };
  }

  if (mediaType === "image") {
    return validateImageFile(file);
  }

  const maxVideoSize = 100 * 1024 * 1024;
  if (file.size > maxVideoSize) {
    return {
      valid: false,
      error: "Video không được vượt quá 100MB",
    };
  }

  return { valid: true };
}

export function ImageUpload({
  productId,
  onUploadSuccess,
  maxFiles = 10,
}: ImageUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const pasteAreaRef = useRef<HTMLDivElement | null>(null);

  const handleFiles = async (files: FileList | File[] | null) => {
    if (!files) return;

    const fileArray = (Array.isArray(files) ? files : Array.from(files)).slice(
      0,
      maxFiles,
    );
    if (fileArray.length === 0) return;

    // Validate files
    const validatedFiles = fileArray.map((file) => {
      const validation = validateMediaFile(file);
      const mediaType = getMediaType(file);
      return { file, validation, mediaType };
    });

    const invalidFiles = validatedFiles.filter((f) => !f.validation.valid);
    if (invalidFiles.length > 0) {
      alert(
        `Một số file không hợp lệ:\n${invalidFiles.map((f) => f.validation.error).join("\n")}`,
      );
      return;
    }

    // Create preview and upload
    for (const { file, mediaType } of validatedFiles) {
      if (!mediaType) continue;

      const preview = URL.createObjectURL(file);
      const uploadFile: UploadingFile = {
        file,
        progress: 0,
        status: mediaType === "image" ? "compressing" : "uploading",
        preview,
        originalSize: file.size,
        mediaType,
      };

      setUploadingFiles((prev) => [...prev, uploadFile]);

      try {
        let uploadTargetFile: File = file;
        let dimensions: { width: number; height: number } | null = null;

        if (mediaType === "image") {
          const compressed = await compressImage(file, 1200, 1200, 0.85);
          dimensions = await getImageDimensions(compressed);

          uploadTargetFile = compressed;
          uploadFile.compressedSize = compressed.size;
          uploadFile.status = "uploading";
          uploadFile.progress = 50;
          setUploadingFiles((prev) => [...prev]);
        }

        // Upload to server
        const formData = new FormData();
        formData.append("file", uploadTargetFile);
        formData.append("productId", productId);
        formData.append("isCover", "false");
        if (dimensions) {
          formData.append("width", dimensions.width.toString());
          formData.append("height", dimensions.height.toString());
        }

        const response = await fetch("/api/admin/product-images", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Upload failed");
        }

        uploadFile.status = "done";
        uploadFile.progress = 100;
        setUploadingFiles((prev) => [...prev]);

        // Remove from list after 2s
        setTimeout(() => {
          setUploadingFiles((prev) => prev.filter((f) => f !== uploadFile));
          URL.revokeObjectURL(preview);
          onUploadSuccess();
        }, 2000);
      } catch (error: unknown) {
        uploadFile.status = "error";
        uploadFile.error =
          error instanceof Error ? error.message : "Upload thất bại";
        setUploadingFiles((prev) => [...prev]);
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  const removeFile = (file: UploadingFile) => {
    setUploadingFiles((prev) => prev.filter((f) => f !== file));
    URL.revokeObjectURL(file.preview);
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    Array.from(items).forEach((item) => {
      if (item.kind !== "file") return;
      const file = item.getAsFile();
      if (!file) return;
      if (file.type.startsWith("image/") || file.type.startsWith("video/")) {
        files.push(file);
      }
    });

    if (files.length === 0) return;

    event.preventDefault();
    void handleFiles(files);
  };

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        }`}
      >
        <input
          type="file"
          id="image-upload"
          className="hidden"
          accept="image/jpeg,image/jpg,image/png,image/webp,video/mp4,video/webm,video/quicktime"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
        />

        <label
          htmlFor="image-upload"
          className="cursor-pointer flex flex-col items-center gap-3"
        >
          <div className="p-4 bg-blue-100 rounded-full">
            <Upload className="w-8 h-8 text-blue-600" />
          </div>
          <div>
            <p className="text-lg font-semibold text-gray-900">
              Kéo thả ảnh/video vào đây hoặc click để chọn
            </p>
            <p className="text-sm text-gray-500 mt-1">
              JPG, PNG, WEBP (≤10MB) • MP4, MOV, WEBM (≤100MB) • Tối đa{" "}
              {maxFiles} file
            </p>
            <p className="text-xs text-blue-600 mt-2">
              ✨ Ảnh sẽ tự động nén và tối ưu hóa, video giữ nguyên chất lượng
            </p>
          </div>
        </label>
      </div>

      <div
        ref={pasteAreaRef}
        tabIndex={0}
        onPaste={handlePaste}
        className="mt-3 inline-flex items-center justify-center rounded border border-dashed border-blue-300 bg-blue-50 px-3 py-1 text-[11px] text-blue-700 cursor-text"
      >
        Click vùng này rồi dùng{" "}
        <span className="mx-1 font-semibold">Ctrl+V</span> /
        <span className="mx-1 font-semibold">Cmd+V</span> để dán ảnh/video từ
        clipboard.
      </div>

      {/* Uploading Files */}
      {uploadingFiles.length > 0 && (
        <div className="space-y-3">
          {uploadingFiles.map((file, index) => (
            <div
              key={index}
              className="bg-white border border-gray-200 rounded-lg p-4"
            >
              <div className="flex items-start gap-4">
                {/* Preview */}
                {file.mediaType === "image" ? (
                  <img
                    src={file.preview}
                    alt="Preview"
                    className="w-16 h-16 object-cover rounded-lg shrink-0"
                  />
                ) : (
                  <video
                    src={file.preview}
                    className="w-16 h-16 object-cover rounded-lg shrink-0"
                    muted
                  />
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 truncate">
                        {file.file.name}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                        <span>{formatFileSize(file.originalSize)}</span>
                        {file.compressedSize && (
                          <>
                            <span>→</span>
                            <span className="text-green-600 font-semibold">
                              {formatFileSize(file.compressedSize)} (
                              {Math.round(
                                ((file.originalSize - file.compressedSize) /
                                  file.originalSize) *
                                  100,
                              )}
                              % nhỏ hơn)
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {file.status === "error" ? (
                      <button
                        onClick={() => removeFile(file)}
                        className="p-1 hover:bg-gray-100 rounded"
                      >
                        <X className="w-4 h-4 text-gray-500" />
                      </button>
                    ) : null}
                  </div>

                  {/* Status */}
                  {file.status === "compressing" && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Đang nén ảnh...</span>
                    </div>
                  )}

                  {file.status === "uploading" && (
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-blue-600">Đang upload...</span>
                        <span className="text-gray-600">{file.progress}%</span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
                          style={{ width: `${file.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {file.status === "done" && (
                    <div className="flex items-center gap-2 text-sm text-green-600">
                      <ImageIcon className="w-4 h-4" />
                      <span>
                        Upload {file.mediaType === "video" ? "video" : "ảnh"}{" "}
                        thành công!
                      </span>
                    </div>
                  )}

                  {file.status === "error" && (
                    <div className="flex items-center gap-2 text-sm text-red-600">
                      <AlertCircle className="w-4 h-4" />
                      <span>{file.error}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
