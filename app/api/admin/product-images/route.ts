import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// GET: Lấy tất cả ảnh của sản phẩm
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const productId = searchParams.get("productId");

    if (!productId) {
      return NextResponse.json(
        { error: "Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    const { data, error } = await supabase
      .from("product_images")
      .select("*")
      .eq("product_id", productId)
      .order("display_order", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error fetching product images:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải danh sách ảnh" },
      { status: 500 },
    );
  }
}

// POST: Upload ảnh mới
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const productId = formData.get("productId") as string;
    const isCover = formData.get("isCover") === "true";
    const width = parseInt(formData.get("width") as string);
    const height = parseInt(formData.get("height") as string);

    if (!file || !productId) {
      return NextResponse.json(
        { error: "File và Product ID là bắt buộc" },
        { status: 400 },
      );
    }

    // Generate unique filename
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExt = file.name.split(".").pop();
    const fileName = `${productId}_${timestamp}_${randomString}.${fileExt}`;
    const filePath = `products/${fileName}`;

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(filePath, file, {
        contentType: file.type,
        cacheControl: "3600",
      });

    if (uploadError) throw uploadError;

    // Get public URL
    const { data: urlData } = supabase.storage
      .from("product-images")
      .getPublicUrl(filePath);

    // Save to database
    const { data: imageRecord, error: dbError } = await supabase
      .from("product_images")
      .insert({
        product_id: productId,
        image_url: urlData.publicUrl,
        storage_path: filePath,
        is_cover: isCover,
        file_size: file.size,
        width: width || null,
        height: height || null,
      })
      .select()
      .single();

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      image: imageRecord,
    });
  } catch (error: any) {
    console.error("Error uploading image:", error);
    return NextResponse.json(
      { error: error.message || "Không thể upload ảnh" },
      { status: 500 },
    );
  }
}

// DELETE: Xóa ảnh
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");

    if (!imageId) {
      return NextResponse.json(
        { error: "Image ID là bắt buộc" },
        { status: 400 },
      );
    }

    // Get image info
    const { data: image, error: fetchError } = await supabase
      .from("product_images")
      .select("*")
      .eq("id", imageId)
      .single();

    if (fetchError) throw fetchError;

    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from("product-images")
      .remove([image.storage_path]);

    if (storageError) {
      console.error("Storage delete error:", storageError);
      // Continue even if storage delete fails
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from("product_images")
      .delete()
      .eq("id", imageId);

    if (dbError) throw dbError;

    return NextResponse.json({
      success: true,
      message: "Đã xóa ảnh thành công",
    });
  } catch (error: any) {
    console.error("Error deleting image:", error);
    return NextResponse.json(
      { error: error.message || "Không thể xóa ảnh" },
      { status: 500 },
    );
  }
}
