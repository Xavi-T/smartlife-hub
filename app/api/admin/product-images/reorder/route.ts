import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

interface ReorderItem {
  id: string;
  display_order: number;
  is_cover?: boolean;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url);
}

// PATCH: Cập nhật thứ tự ảnh
export async function PATCH(request: NextRequest) {
  try {
    const sb = supabase as any;
    const body = await request.json();
    const { images } = body as { images?: ReorderItem[] }; // Array of { id, display_order, is_cover }

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }

    // Update each image
    const updatePromises = images.map((img) =>
      sb
        .from("product_images")
        .update({
          display_order: img.display_order,
          is_cover: img.is_cover || false,
        })
        .eq("id", img.id),
    );

    const results = await Promise.all(updatePromises);

    // Check for errors
    const errors = results.filter((r) => r.error);
    if (errors.length > 0) {
      throw new Error("Có lỗi khi cập nhật thứ tự ảnh");
    }

    const coverImage = images.find((img) => img.is_cover);
    if (coverImage) {
      const { data: coverRow, error: coverFetchError } = await sb
        .from("product_images")
        .select("product_id, image_url")
        .eq("id", coverImage.id)
        .single();

      if (!coverFetchError && coverRow?.product_id && coverRow?.image_url) {
        if (!isVideoUrl(coverRow.image_url)) {
          const { error: productUpdateError } = await sb
            .from("products")
            .update({ image_url: coverRow.image_url })
            .eq("id", coverRow.product_id);

          if (productUpdateError) {
            console.error(
              "Error syncing product cover image after reorder:",
              productUpdateError,
            );
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật thứ tự ảnh",
    });
  } catch (error: unknown) {
    console.error("Error reordering images:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể cập nhật thứ tự ảnh",
      },
      { status: 500 },
    );
  }
}
