"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Space,
  message,
  Image,
  Breadcrumb,
  Typography,
} from "antd";
import {
  UploadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  CopyOutlined,
  SearchOutlined,
  FolderAddOutlined,
  FolderOpenOutlined,
  EditOutlined,
  FolderOutlined,
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

type RenameTarget =
  | { type: "file"; item: MediaFile }
  | { type: "folder"; item: MediaFolder }
  | null;

type DeleteTarget =
  | { type: "file"; item: MediaFile }
  | { type: "folder"; item: MediaFolder }
  | null;

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
  const [currentPath, setCurrentPath] = useState("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget>(null);
  const [renameValue, setRenameValue] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchFiles = useCallback(
    async (targetPath: string) => {
      try {
        const pathQuery = targetPath
          ? `?path=${encodeURIComponent(targetPath)}`
          : "";
        const res = await fetch(`/api/admin/media${pathQuery}`);
        const result = (await res.json()) as MediaListResponse & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(result.error || "Không thể tải media");
        }

        setCurrentPath(result.currentPath || "");
        setParentPath(result.parentPath || null);
        setFolders(result.folders || []);
        setFiles(result.files || []);
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error ? error.message : "Không thể tải media";
        messageApi.error(errorMessage);
      } finally {
        setLoading(false);
      }
    },
    [messageApi],
  );

  useEffect(() => {
    fetchFiles("");
  }, [fetchFiles]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const targetFiles = event.target.files;
    if (!targetFiles || targetFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(targetFiles)) {
        const formData = new FormData();
        formData.append("action", "upload");
        formData.append("file", file);
        formData.append("folderPath", currentPath);

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
      await fetchFiles(currentPath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể upload media";
      messageApi.error(errorMessage);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const openFilePicker = () => {
    if (uploading) return;
    fileInputRef.current?.click();
  };

  const handleCreateFolder = async () => {
    const folderName = newFolderName.trim();
    if (!folderName) {
      messageApi.error("Vui lòng nhập tên folder");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("action", "create-folder");
      formData.append("folderName", folderName);
      formData.append("parentPath", currentPath);

      const res = await fetch("/api/admin/media", {
        method: "POST",
        body: formData,
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Không thể tạo folder");
      }

      setNewFolderName("");
      setIsCreateFolderOpen(false);
      messageApi.success("Tạo folder thành công");
      await fetchFiles(currentPath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể tạo folder";
      messageApi.error(errorMessage);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    try {
      const res = await fetch(
        `/api/admin/media?path=${encodeURIComponent(deleteTarget.item.path)}&type=${deleteTarget.type}`,
        {
          method: "DELETE",
        },
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Không thể xóa file");

      messageApi.success(
        deleteTarget.type === "folder" ? "Đã xóa folder" : "Đã xóa file media",
      );
      setDeleteTarget(null);
      if (
        deleteTarget.type === "file" &&
        selectedFile?.path === deleteTarget.item.path
      ) {
        setSelectedFile(null);
      }
      await fetchFiles(currentPath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể xóa file";
      messageApi.error(errorMessage);
    }
  };

  const handleRename = async () => {
    if (!renameTarget) return;

    const newName = renameValue.trim();
    if (!newName) {
      messageApi.error("Tên mới không được để trống");
      return;
    }

    try {
      const res = await fetch("/api/admin/media", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action:
            renameTarget.type === "folder" ? "rename-folder" : "rename-file",
          path: renameTarget.item.path,
          newName,
        }),
      });

      const result = await res.json();
      if (!res.ok) {
        throw new Error(result.error || "Không thể đổi tên");
      }

      setRenameTarget(null);
      setRenameValue("");
      messageApi.success("Đổi tên thành công");
      await fetchFiles(currentPath);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Không thể đổi tên";
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
  const filteredFolders = folders.filter((folder) =>
    folder.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const breadcrumbItems = [
    {
      title: (
        <a
          onClick={(event) => {
            event.preventDefault();
            fetchFiles("");
          }}
        >
          Media
        </a>
      ),
    },
    ...currentPath
      .split("/")
      .filter(Boolean)
      .map((segment, index, arr) => {
        const path = arr.slice(0, index + 1).join("/");
        return {
          title: (
            <a
              onClick={(event) => {
                event.preventDefault();
                fetchFiles(path);
              }}
            >
              {segment}
            </a>
          ),
        };
      }),
  ];

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
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleUpload}
            style={{ display: "none" }}
            disabled={uploading}
          />

          <Button
            icon={<ReloadOutlined />}
            onClick={() => fetchFiles(currentPath)}
            loading={loading}
          >
            Làm mới
          </Button>
          <Button
            icon={<FolderAddOutlined />}
            onClick={() => setIsCreateFolderOpen(true)}
          >
            Tạo folder
          </Button>
          <Button
            type="primary"
            icon={<UploadOutlined />}
            loading={uploading}
            onClick={openFilePicker}
            disabled={uploading}
          >
            Upload ảnh
          </Button>
        </Space>
      </div>

      <Card style={{ marginBottom: 16 }}>
        <Space orientation="vertical" style={{ width: "100%" }}>
          <Breadcrumb items={breadcrumbItems} />
          <Space>
            <Typography.Text type="secondary">Đường dẫn:</Typography.Text>
            <Typography.Text code>
              {currentPath || "media-library"}
            </Typography.Text>
            {parentPath && (
              <Button size="small" onClick={() => fetchFiles(parentPath)}>
                Lên thư mục cha
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm theo tên file..."
          prefix={<SearchOutlined />}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          allowClear
        />
      </Card>

      {filteredFolders.length === 0 && filteredFiles.length === 0 ? (
        <Card>
          <Empty description={loading ? "Đang tải..." : "Chưa có ảnh nào"} />
        </Card>
      ) : (
        <Space orientation="vertical" style={{ width: "100%" }} size={16}>
          {filteredFolders.length > 0 && (
            <Card title="Folders">
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: 16,
                }}
              >
                {filteredFolders.map((folder) => (
                  <Card
                    key={folder.path}
                    hoverable
                    actions={[
                      <EditOutlined
                        key="rename-folder"
                        onClick={(event) => {
                          event.stopPropagation();
                          setRenameTarget({ type: "folder", item: folder });
                          setRenameValue(folder.name);
                        }}
                      />,
                      <DeleteOutlined
                        key="delete-folder"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget({ type: "folder", item: folder });
                        }}
                      />,
                    ]}
                    onClick={() => fetchFiles(folder.path)}
                  >
                    <Space align="center">
                      <FolderOpenOutlined
                        style={{ color: "#1677ff", fontSize: 20 }}
                      />
                      <div>
                        <div style={{ fontWeight: 600 }}>{folder.name}</div>
                        <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                          {folder.path}
                        </div>
                      </div>
                    </Space>
                  </Card>
                ))}
              </div>
            </Card>
          )}

          {filteredFiles.length > 0 && (
            <Card title="Files">
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
                      <EditOutlined
                        key="rename"
                        onClick={() => {
                          setRenameTarget({ type: "file", item: file });
                          setRenameValue(file.name);
                        }}
                      />,
                      <DeleteOutlined
                        key="delete"
                        onClick={() =>
                          setDeleteTarget({ type: "file", item: file })
                        }
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
                      <FolderOutlined
                        style={{ marginRight: 6, color: "#1677ff" }}
                      />
                      {file.name}
                    </div>
                    <div style={{ color: "#8c8c8c", fontSize: 12 }}>
                      {formatBytes(file.size)}
                    </div>
                  </Card>
                ))}
              </div>
            </Card>
          )}
        </Space>
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
          <Space orientation="vertical" style={{ width: "100%" }} size="middle">
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
          <p>
            Bạn chắc chắn muốn xóa
            {deleteTarget.type === "folder" ? " folder " : " file "}
            <strong>{deleteTarget.item.name}</strong>?
          </p>
        )}
      </Modal>

      <Modal
        title="Tạo folder mới"
        open={isCreateFolderOpen}
        onCancel={() => setIsCreateFolderOpen(false)}
        onOk={handleCreateFolder}
        okText="Tạo"
        cancelText="Hủy"
      >
        <Input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Nhập tên folder"
          onPressEnter={handleCreateFolder}
        />
      </Modal>

      <Modal
        title={
          renameTarget?.type === "folder" ? "Đổi tên folder" : "Đổi tên file"
        }
        open={!!renameTarget}
        onCancel={() => setRenameTarget(null)}
        onOk={handleRename}
        okText="Lưu"
        cancelText="Hủy"
      >
        <Input
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          placeholder="Nhập tên mới"
          onPressEnter={handleRename}
        />
      </Modal>
    </div>
  );
}
