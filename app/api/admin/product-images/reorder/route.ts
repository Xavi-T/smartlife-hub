import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// PATCH: Cập nhật thứ tự ảnh
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { images } = body; // Array of { id, display_order, is_cover }

    if (!images || !Array.isArray(images)) {
      return NextResponse.json(
        { error: "Dữ liệu không hợp lệ" },
        { status: 400 },
      );
    }

    // Update each image
    const updatePromises = images.map((img: any) =>
      supabase
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

    return NextResponse.json({
      success: true,
      message: "Đã cập nhật thứ tự ảnh",
    });
  } catch (error: any) {
    console.error("Error reordering images:", error);
    return NextResponse.json(
      { error: error.message || "Không thể cập nhật thứ tự ảnh" },
      { status: 500 },
    );
  }
}
