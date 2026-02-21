"use client";

import { useState, useCallback, useEffect } from "react";
import { DndProvider, useDrag, useDrop } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { message, Modal } from "antd";
import {
  GripVertical,
  Trash2,
  Star,
  Image as ImageIcon,
  Video,
  Loader2,
} from "lucide-react";

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

function detectMediaType(url: string): "image" | "video" {
  const normalized = url.toLowerCase();
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/.test(normalized) ? "video" : "image";
}

interface ImageGalleryProps {
  images: ProductImage[];
  onImagesChange: () => void;
}

interface DraggableImageProps {
  image: ProductImage;
  index: number;
  moveImage: (dragIndex: number, hoverIndex: number) => void;
  onDelete: (imageId: string) => void;
  onSetCover: (imageId: string) => void;
  canSetCover: boolean;
  isDeleting: boolean;
}

const DraggableImage = ({
  image,
  index,
  moveImage,
  onDelete,
  onSetCover,
  canSetCover,
  isDeleting,
}: DraggableImageProps) => {
  const mediaType = image.media_type || detectMediaType(image.image_url);

  const [{ isDragging }, drag] = useDrag({
    type: "image",
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: "image",
    hover: (item: { index: number }) => {
      if (item.index !== index) {
        moveImage(item.index, index);
        item.index = index;
      }
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  });

  return (
    <div
      ref={(node) => {
        drag(drop(node));
      }}
      className={`relative group bg-white border-2 rounded-lg overflow-hidden transition-all ${
        isDragging ? "opacity-50 scale-95" : ""
      } ${isOver ? "border-blue-500 shadow-lg" : "border-gray-200"} ${
        image.is_cover ? "ring-2 ring-purple-500" : ""
      }`}
    >
      {/* Cover Badge */}
      {image.is_cover && (
        <div className="absolute top-2 left-2 z-10">
          <div className="flex items-center gap-1 px-2 py-1 bg-purple-600 text-white text-xs font-semibold rounded-full shadow-lg">
            <Star className="w-3 h-3 fill-current" />
            Ảnh bìa
          </div>
        </div>
      )}

      {/* Drag Handle */}
      <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="p-1.5 bg-white/90 backdrop-blur rounded-lg shadow-lg cursor-move">
          <GripVertical className="w-4 h-4 text-gray-600" />
        </div>
      </div>

      {/* Media */}
      <div className="aspect-square relative">
        {mediaType === "video" ? (
          <video src={image.image_url} className="w-full h-full object-cover" />
        ) : (
          <img
            src={image.image_url}
            alt="Product"
            className="w-full h-full object-cover"
          />
        )}

        {mediaType === "video" && (
          <div className="absolute bottom-2 left-2 z-10">
            <div className="flex items-center gap-1 px-2 py-1 bg-black/65 text-white text-xs rounded-full">
              <Video className="w-3 h-3" />
              Video
            </div>
          </div>
        )}

        {/* Overlay with actions */}
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          {!image.is_cover && canSetCover && (
            <button
              onClick={() => onSetCover(image.id)}
              className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
              title="Đặt làm ảnh bìa"
            >
              <Star className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={() => onDelete(image.id)}
            disabled={isDeleting}
            className="p-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
            title="Xóa media"
          >
            {isDeleting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Info */}
      <div className="p-2 bg-gray-50 border-t border-gray-200">
        <div className="text-xs text-gray-600 text-center space-y-1">
          {image.width && image.height && (
            <span>
              {image.width} × {image.height}
            </span>
          )}
          {!image.is_cover && canSetCover && (
            <div>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onSetCover(image.id);
                }}
                className="text-[11px] px-2 py-1 rounded border border-purple-300 text-purple-700 hover:bg-purple-50"
              >
                Đặt làm ảnh đại diện
              </button>
            </div>
          )}
          {mediaType === "video" && (
            <div className="text-[11px] text-gray-400">
              Video không làm ảnh đại diện
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

function ImageGalleryContent({ images, onImagesChange }: ImageGalleryProps) {
  const [messageApi, messageContextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [localImages, setLocalImages] = useState<ProductImage[]>(images);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setLocalImages(images);
  }, [images]);

  const moveImage = useCallback((dragIndex: number, hoverIndex: number) => {
    setLocalImages((prevImages) => {
      const newImages = [...prevImages];
      const [draggedImage] = newImages.splice(dragIndex, 1);
      newImages.splice(hoverIndex, 0, draggedImage);

      // Update display_order
      return newImages.map((img, idx) => ({
        ...img,
        display_order: idx,
      }));
    });
  }, []);

  const handleSaveOrder = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/product-images/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: localImages.map((img) => ({
            id: img.id,
            display_order: img.display_order,
            is_cover: img.is_cover,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to save order");

      messageApi.success("Đã lưu thứ tự media");
      onImagesChange();
    } catch {
      messageApi.error("Không thể lưu thứ tự media");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (imageId: string) => {
    const isConfirmed = await new Promise<boolean>((resolve) => {
      modal.confirm({
        title: "Xóa media",
        content: "Bạn có chắc chắn muốn xóa media này không?",
        okText: "Xóa",
        cancelText: "Hủy",
        okButtonProps: { danger: true },
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });

    if (!isConfirmed) return;

    setDeletingId(imageId);
    try {
      const response = await fetch(
        `/api/admin/product-images?imageId=${imageId}`,
        {
          method: "DELETE",
        },
      );

      if (!response.ok) throw new Error("Failed to delete");

      setLocalImages((prev) => prev.filter((img) => img.id !== imageId));
      messageApi.success("Đã xóa media");
      onImagesChange();
    } catch {
      messageApi.error("Không thể xóa media");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSetCover = async (imageId: string) => {
    const updatedImages = localImages.map((img) => ({
      ...img,
      is_cover: img.id === imageId,
    }));

    setLocalImages(updatedImages);

    try {
      const response = await fetch("/api/admin/product-images/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: updatedImages.map((img) => ({
            id: img.id,
            display_order: img.display_order,
            is_cover: img.id === imageId,
          })),
        }),
      });

      if (!response.ok) throw new Error("Failed to set cover");

      messageApi.success("Đã đặt media bìa");
      onImagesChange();
    } catch {
      messageApi.error("Không thể đặt media bìa");
    }
  };

  const hasChanges = JSON.stringify(localImages) !== JSON.stringify(images);

  return (
    <div className="space-y-4">
      {messageContextHolder}
      {modalContextHolder}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ImageIcon className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">
            Gallery ({localImages.length} media)
          </h3>
        </div>

        {hasChanges && (
          <button
            onClick={handleSaveOrder}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Đang lưu...
              </>
            ) : (
              "Lưu thứ tự"
            )}
          </button>
        )}
      </div>

      {/* Gallery Grid */}
      {localImages.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {localImages.map((image, index) => (
            <DraggableImage
              key={image.id}
              image={image}
              index={index}
              moveImage={moveImage}
              onDelete={handleDelete}
              onSetCover={handleSetCover}
              canSetCover={
                (image.media_type || detectMediaType(image.image_url)) ===
                "image"
              }
              isDeleting={deletingId === image.id}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <ImageIcon className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p>Chưa có media nào</p>
        </div>
      )}

      {/* Instructions */}
      {localImages.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-900">
            💡 <strong>Hướng dẫn:</strong> Kéo thả để sắp xếp thứ tự media • Nút
            Đặt làm ảnh đại diện để chọn ảnh bìa • Click 🗑️ để xóa
          </p>
        </div>
      )}
    </div>
  );
}

export function ImageGallery(props: ImageGalleryProps) {
  return (
    <DndProvider backend={HTML5Backend}>
      <ImageGalleryContent {...props} />
    </DndProvider>
  );
}
