import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET() {
  try {
    // Query order_items joined with products and orders
    // Only count delivered orders for actual sales
    const { data: topProducts, error } = await supabase
      .from("order_items")
      .select(
        `
        product_id,
        quantity,
        unit_price,
        products!inner(
          id,
          name,
          image_url,
          category,
          cost_price
        ),
        orders!inner(
          status
        )
      `,
      )
      .eq("orders.status", "delivered");

    if (error) throw error;

    // Group by product and calculate totals
    const productStats = new Map<
      string,
      {
        product_id: string;
        name: string;
        image_url: string | null;
        category: string;
        total_quantity: number;
        total_revenue: number;
        total_profit: number;
      }
    >();

    topProducts.forEach((item: any) => {
      const productId = item.product_id;
      const product = item.products;
      const quantity = item.quantity;
      const revenue = item.unit_price * quantity;
      const profit = (item.unit_price - (product.cost_price || 0)) * quantity;

      if (productStats.has(productId)) {
        const existing = productStats.get(productId)!;
        existing.total_quantity += quantity;
        existing.total_revenue += revenue;
        existing.total_profit += profit;
      } else {
        productStats.set(productId, {
          product_id: productId,
          name: product.name,
          image_url: product.image_url,
          category: product.category,
          total_quantity: quantity,
          total_revenue: revenue,
          total_profit: profit,
        });
      }
    });

    // Convert to array and sort by quantity
    const sortedProducts = Array.from(productStats.values())
      .sort((a, b) => b.total_quantity - a.total_quantity)
      .slice(0, 5);

    // Calculate max quantity for progress bar percentages
    const maxQuantity = sortedProducts[0]?.total_quantity || 1;

    // Add percentage for each product
    const productsWithPercentage = sortedProducts.map((product, index) => ({
      ...product,
      rank: index + 1,
      percentage: (product.total_quantity / maxQuantity) * 100,
    }));

    return NextResponse.json(productsWithPercentage);
  } catch (error) {
    console.error("Error fetching top products:", error);
    return NextResponse.json(
      { error: "Failed to fetch top products" },
      { status: 500 },
    );
  }
}
