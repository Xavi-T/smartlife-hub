"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Input, Modal, Space, message, Image } from "antd";
import {
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CopyOutlined,
  SearchOutlined,
} from "@ant-design/icons";

interface MediaFile {
  name: string;
  path: string;
  url: string;
  size: number;
  mimeType: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const index = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  const value = bytes / 1024 ** index;
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export default function MediaPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);

  const fetchFiles = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/media");
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Không thể tải media");
      setFiles(result.files || []);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tải media";
      messageApi.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [messageApi]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetFiles = event.target.files;
    if (!targetFiles || targetFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(targetFiles)) {
        const formData = new FormData();
        formData.append("file", file);

        const res = await fetch("/api/admin/media", {
          method: "POST",
          body: formData,
        });

        const result = await res.json();
        if (!res.ok) {
          throw new Error(result.error || `Upload thất bại: ${file.name}`);
        }
      }

      messageApi.success("Upload media thành công");
      await fetchFiles();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể upload media";
      messageApi.error(errorMessage);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(
        `/api/admin/media?path=${encodeURIComponent(deleteTarget.path)}`,
        {
          method: "DELETE",
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Không thể xóa file");

      messageApi.success("Đã xóa file media");
      setDeleteTarget(null);
      if (selectedFile?.path === deleteTarget.path) {
        setSelectedFile(null);
      }
      await fetchFiles();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa file";
      messageApi.error(errorMessage);
    }
  };

  const handleCopyUrl = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      messageApi.success("Đã copy URL ảnh");
    } catch {
      messageApi.error("Không thể copy URL");
    }
  };

  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div style={{ minHeight: "100vh", background: "#f5f5f5", padding: 24 }}>
      {contextHolder}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>
            Thư viện Media
          </h1>
          <p style={{ margin: "4px 0 0 0", color: "#8c8c8c" }}>
            Upload và quản lý ảnh dùng chung cho tạo mới hoặc đăng bán sản phẩm
          </p>
        </div>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={fetchFiles}
            loading={loading}
          >
            Làm mới
          </Button>
          <label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleUpload}
              style={{ display: "none" }}
              disabled={uploading}
            />
            <Button
              type="primary"
              icon={<UploadOutlined />}
              loading={uploading}
            >
              Upload ảnh
            </Button>
          </label>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm theo tên file..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </Card>

      {filteredFiles.length === 0 ? (
        <Card>
          <Empty description={loading ? "Đang tải..." : "Chưa có ảnh nào"} />
        </Card>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          {filteredFiles.map((file) => (
            <Card
              key={file.path}
              hoverable
              cover={
                <div
                  style={{
                    height: 180,
                    overflow: "hidden",
                    background: "#fafafa",
                  }}
                >
                  <Image
                    src={file.url}
                    alt={file.name}
                    width="100%"
                    height={180}
                    style={{ objectFit: "cover" }}
                    preview={false}
                  />
                </div>
              }
              actions={[
                <CopyOutlined
                  key="copy"
                  onClick={() => handleCopyUrl(file.url)}
                />,
                <DeleteOutlined
                  key="delete"
                  onClick={() => setDeleteTarget(file)}
                />,
              ]}
              onClick={() => setSelectedFile(file)}
            >
              <div
                style={{
                  fontWeight: 600,
                  marginBottom: 4,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {file.name}
              </div>
              <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                {formatBytes(file.size)}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Chi tiết media"
        open={!!selectedFile}
        onCancel={() => setSelectedFile(null)}
        footer={
          selectedFile
            ? [
                <Button
                  key="copy"
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyUrl(selectedFile.url)}
                >
                  Copy URL
                </Button>,
                <Button key="close" onClick={() => setSelectedFile(null)}>
                  Đóng
                </Button>,
              ]
            : null
        }
      >
        {selectedFile && (
          <Space direction="vertical" style={{ width: "100%" }} size="middle">
            <Image
              src={selectedFile.url}
              alt={selectedFile.name}
              width="100%"
            />
            <div>
              <strong>Tên file:</strong> {selectedFile.name}
            </div>
            <div>
              <strong>Kích thước:</strong> {formatBytes(selectedFile.size)}
            </div>
            <div>
              <strong>URL:</strong>
            </div>
            <Input.TextArea value={selectedFile.url} autoSize readOnly />
          </Space>
        )}
      </Modal>

      <Modal
        title="Xóa file media"
        open={!!deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onOk={handleDelete}
        okButtonProps={{ danger: true }}
        okText="Xóa"
        cancelText="Hủy"
      >
        {deleteTarget && (
          <p>Bạn chắc chắn muốn xóa file {deleteTarget.name}?</p>
        )}
      </Modal>
    </div>
  );
}
