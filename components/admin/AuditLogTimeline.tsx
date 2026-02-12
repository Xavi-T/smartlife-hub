"use client";

import {
  Clock,
  Package,
  ShoppingBag,
  TrendingUp,
  User,
  Calendar,
} from "lucide-react";

interface AuditLog {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  actor: string;
  action: string;
  description: string;
  old_values: any;
  new_values: any;
  metadata: any;
  created_at: string;
}

interface AuditLogTimelineProps {
  logs: AuditLog[];
  groupedLogs: Record<string, AuditLog[]>;
}

export function AuditLogTimeline({ logs, groupedLogs }: AuditLogTimelineProps) {
  const getEventIcon = (eventType: string, entityType: string) => {
    if (eventType.includes("product")) {
      return <Package className="w-5 h-5 text-blue-600" />;
    }
    if (eventType.includes("order")) {
      return <ShoppingBag className="w-5 h-5 text-green-600" />;
    }
    if (eventType.includes("stock")) {
      return <TrendingUp className="w-5 h-5 text-purple-600" />;
    }
    return <Clock className="w-5 h-5 text-gray-600" />;
  };

  const getEventColor = (eventType: string) => {
    if (eventType.includes("created")) return "border-green-500 bg-green-50";
    if (eventType.includes("updated")) return "border-blue-500 bg-blue-50";
    if (eventType.includes("deleted") || eventType.includes("cancelled"))
      return "border-red-500 bg-red-50";
    if (eventType.includes("stock")) return "border-purple-500 bg-purple-50";
    return "border-gray-500 bg-gray-50";
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Vừa xong";
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
  };

  if (logs.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-400" />
        <p>Chưa có hoạt động nào được ghi nhận</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {Object.entries(groupedLogs).map(([date, dayLogs]) => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h3 className="text-lg font-bold text-gray-900">{date}</h3>
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-sm text-gray-500">
              {dayLogs.length} hoạt động
            </span>
          </div>

          {/* Timeline */}
          <div className="relative space-y-4 pl-8">
            {/* Vertical Line */}
            <div className="absolute left-2 top-0 bottom-0 w-0.5 bg-gray-200" />

            {dayLogs.map((log, index) => (
              <div key={log.id} className="relative">
                {/* Timeline Dot */}
                <div
                  className={`absolute -left-8 mt-1 w-4 h-4 rounded-full border-2 ${getEventColor(
                    log.event_type,
                  )}`}
                />

                {/* Log Card */}
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      {/* Icon */}
                      <div className="flex-shrink-0 p-2 bg-gray-50 rounded-lg">
                        {getEventIcon(log.event_type, log.entity_type)}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <p className="text-gray-900 font-medium mb-1">
                          {log.description}
                        </p>

                        {/* Metadata */}
                        <div className="flex items-center gap-3 text-xs text-gray-500">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            <span>{log.actor}</span>
                          </div>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            <span>{formatTime(log.created_at)}</span>
                          </div>
                          <span>•</span>
                          <span className="text-gray-400">
                            {formatRelativeTime(log.created_at)}
                          </span>
                        </div>

                        {/* Old/New Values */}
                        {(log.old_values || log.new_values) && (
                          <div className="mt-3 flex items-start gap-4 text-xs">
                            {log.old_values && (
                              <div className="bg-red-50 border border-red-200 rounded px-2 py-1">
                                <span className="text-red-600 font-semibold">
                                  Cũ:{" "}
                                </span>
                                <span className="text-red-900">
                                  {JSON.stringify(log.old_values, null, 2)
                                    .replace(/[{}"]/g, "")
                                    .trim()}
                                </span>
                              </div>
                            )}
                            {log.new_values && (
                              <div className="bg-green-50 border border-green-200 rounded px-2 py-1">
                                <span className="text-green-600 font-semibold">
                                  Mới:{" "}
                                </span>
                                <span className="text-green-900">
                                  {JSON.stringify(log.new_values, null, 2)
                                    .replace(/[{}"]/g, "")
                                    .trim()}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Event Type Badge */}
                    <div>
                      <span className="inline-block px-2 py-1 bg-gray-100 text-gray-600 text-xs font-medium rounded">
                        {log.event_type}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
