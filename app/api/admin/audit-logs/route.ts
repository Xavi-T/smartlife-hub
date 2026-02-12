import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const eventType = searchParams.get("eventType");
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    // Filters
    if (eventType && eventType !== "all") {
      query = query.eq("event_type", eventType);
    }

    if (entityType && entityType !== "all") {
      query = query.eq("entity_type", entityType);
    }

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Group by date for timeline
    const groupedLogs: Record<string, any[]> = {};
    data.forEach((log) => {
      const date = new Date(log.created_at).toLocaleDateString("vi-VN");
      if (!groupedLogs[date]) {
        groupedLogs[date] = [];
      }
      groupedLogs[date].push(log);
    });

    // Calculate stats
    const stats = {
      totalLogs: data.length,
      productEvents: data.filter((l) => l.entity_type === "product").length,
      orderEvents: data.filter((l) => l.entity_type === "order").length,
      stockEvents: data.filter((l) => l.event_type?.includes("stock")).length,
      todayLogs: data.filter((l) => {
        const logDate = new Date(l.created_at).toDateString();
        const today = new Date().toDateString();
        return logDate === today;
      }).length,
    };

    return NextResponse.json({
      logs: data,
      groupedLogs,
      stats,
    });
  } catch (error: any) {
    console.error("Error fetching audit logs:", error);
    return NextResponse.json(
      { error: error.message || "Không thể tải audit logs" },
      { status: 500 },
    );
  }
}
