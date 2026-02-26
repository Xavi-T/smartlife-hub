"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Form,
  Image as AntImage,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import type { RcFile, UploadFile } from "antd/es/upload/interface";
import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  InboxOutlined,
  ReloadOutlined,
  SaveOutlined,
} from "@ant-design/icons";
import { formatFileSize } from "@/lib/imageUtils";

// const HOMEPAGE_BANNER_MIN_RATIO = 2.2;
// const HOMEPAGE_BANNER_MAX_RATIO = 4.2;

type MediaItem = {
  id: string;
  media_key: string | null;
  purpose: string;
  alt_text: string | null;
  file_name: string;
  mime_type: string;
  file_size: number;
  image_url: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  display_order: number | null;
  created_at: string;
};

type UploadFormValues = {
  purpose: string;
  mediaKey?: string;
  altText?: string;
  displayOrder?: number;
};

type EditFormValues = {
  purpose: string;
  mediaKey?: string;
  altText?: string;
  displayOrder?: number;
};

const PURPOSE_OPTIONS = [
  { value: "site_logo", label: "Logo website" },
  { value: "site_favicon", label: "Favicon" },
  { value: "bank_qrcode", label: "QR chuyển khoản ngân hàng" },
  { value: "homepage_banner", label: "Banner trang chủ" },
];

const PURPOSE_LABEL_MAP = new Map(
  PURPOSE_OPTIONS.map((item) => [item.value, item.label]),
);

export default function MediaManagerPage() {
  const [messageApi, contextHolder] = message.useMessage();
  const [uploadForm] = Form.useForm<UploadFormValues>();
  const [editForm] = Form.useForm<EditFormValues>();

  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [purposeFilter, setPurposeFilter] = useState<string>("all");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [editingItem, setEditingItem] = useState<MediaItem | null>(null);
  const selectedUploadPurpose = Form.useWatch("purpose", uploadForm);

  const handlePasteToDragger = (
    event: React.ClipboardEvent<HTMLDivElement>,
  ) => {
    const items = event.clipboardData?.items;
    if (!items) return;

    const nextFiles: UploadFile[] = [];
    Array.from(items).forEach((item) => {
      if (item.kind !== "file") return;
      const file = item.getAsFile();
      if (!file) return;
      if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) {
        return;
      }

      const uid = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      nextFiles.push({
        uid,
        name: file.name || `pasted-${uid}`,
        originFileObj: file as RcFile,
        size: file.size,
        type: file.type,
        status: "done",
      });
    });

    if (nextFiles.length === 0) return;

    event.preventDefault();
    setFileList(
      selectedUploadPurpose === "homepage_banner" ? nextFiles : nextFiles.slice(0, 1),
    );
  };

  const fetchMedia = async (params?: { q?: string; purpose?: string }) => {
    const q = params?.q ?? search;
    const purpose = params?.purpose ?? purposeFilter;

    setLoading(true);
    try {
      const query = new URLSearchParams();
      if (q.trim()) query.set("q", q.trim());
      if (purpose !== "all") query.set("purpose", purpose);

      const response = await fetch(`/api/admin/media?${query.toString()}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể tải danh sách media");
      }

      setItems(Array.isArray(result.media) ? result.media : []);
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error
          ? error.message
          : "Không thể tải danh sách media",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    uploadForm.setFieldsValue({ purpose: "site_logo", displayOrder: 1 });
    fetchMedia({ q: "", purpose: "all" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedUploadPurpose !== "homepage_banner" && fileList.length > 1) {
      setFileList(fileList.slice(-1));
    }
  }, [fileList, selectedUploadPurpose]);

  const handleUpload = async (values: UploadFormValues) => {
    const isBanner = values.purpose === "homepage_banner";
    const selectedFiles = fileList
      .map((item) => item.originFileObj)
      .filter(Boolean) as File[];

    if (selectedFiles.length === 0) {
      messageApi.error("Vui lòng chọn file trước khi upload");
      return;
    }
    const filesToUpload = isBanner ? selectedFiles : [selectedFiles[0]];

    for (const currentFile of filesToUpload) {
      const isVideoFile = currentFile.type.startsWith("video/");
      if (isVideoFile && !isBanner) {
        messageApi.error("Video chỉ được phép upload cho Banner trang chủ");
        return;
      }
      if (!isVideoFile && !currentFile.type.startsWith("image/")) {
        messageApi.error("Chỉ hỗ trợ file ảnh hoặc video");
        return;
      }
    }

    setUploading(true);
    try {
      for (let index = 0; index < filesToUpload.length; index += 1) {
        const file = filesToUpload[index];
        const formData = new FormData();
        formData.append("file", file);
        formData.append("purpose", values.purpose || "site_logo");
        if (values.mediaKey?.trim()) {
          formData.append("mediaKey", values.mediaKey.trim());
        }
        if (values.altText?.trim()) {
          formData.append("altText", values.altText.trim());
        }
        if (isBanner && typeof values.displayOrder === "number") {
          formData.append(
            "displayOrder",
            String(Math.max(1, values.displayOrder + index)),
          );
        }

        // if (!file.type.startsWith("video/")) {
        //   try {
        //     const dimensions = await getImageDimensions(file);
        //     formData.append("width", String(dimensions.width));
        //     formData.append("height", String(dimensions.height));
        //   } catch {
        //     // Keep width/height empty if browser cannot parse the image
        //   }
        // }

        const response = await fetch("/api/admin/media", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Upload thất bại");
        }
      }

      messageApi.success(
        isBanner && filesToUpload.length > 1
          ? `Upload thành công ${filesToUpload.length} banner`
          : "Upload media thành công",
      );
      setFileList([]);
      uploadForm.resetFields();
      uploadForm.setFieldsValue({ purpose: "site_logo", displayOrder: 1 });
      fetchMedia();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Upload thất bại",
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await fetch(`/api/admin/media/${id}`, {
        method: "DELETE",
      });
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Không thể xóa media");
      }

      messageApi.success("Đã xóa media");
      fetchMedia();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể xóa media",
      );
    }
  };

  const openEditModal = (item: MediaItem) => {
    setEditingItem(item);
    editForm.setFieldsValue({
      purpose: item.purpose,
      mediaKey: item.media_key || undefined,
      altText: item.alt_text || undefined,
      displayOrder: item.display_order || undefined,
    });
  };

  const handleSaveMetadata = async (values: EditFormValues) => {
    if (!editingItem) return;

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/media/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...values,
          displayOrder:
            values.purpose === "homepage_banner" &&
            typeof values.displayOrder === "number"
              ? Math.max(1, values.displayOrder)
              : null,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "Không thể cập nhật media");
      }

      messageApi.success("Đã cập nhật metadata");
      setEditingItem(null);
      fetchMedia();
    } catch (error: unknown) {
      messageApi.error(
        error instanceof Error ? error.message : "Không thể cập nhật media",
      );
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (value: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(value);
      messageApi.success(successMessage);
    } catch {
      messageApi.error("Không thể copy vào clipboard");
    }
  };

  const columns = useMemo(
    () => [
      {
        title: "Preview",
        dataIndex: "image_url",
        key: "preview",
        width: 130,
        render: (url: string, record: MediaItem) =>
          record.mime_type.startsWith("video/") ? (
            <video
              src={url}
              width={88}
              height={56}
              style={{ objectFit: "cover", borderRadius: 8 }}
              muted
              playsInline
              controls
            />
          ) : (
            <AntImage
              src={url}
              alt={record.alt_text || record.file_name}
              width={88}
              height={56}
              style={{ objectFit: "cover", borderRadius: 8 }}
            />
          ),
      },
      {
        title: "Thông tin",
        key: "info",
        render: (_: unknown, record: MediaItem) => (
          <Space orientation="vertical" size={2}>
            <Typography.Text strong>{record.file_name}</Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {formatFileSize(record.file_size)}
              {record.width && record.height
                ? ` • ${record.width}x${record.height}`
                : ""}
              {record.purpose === "homepage_banner" && record.display_order
                ? ` • Thứ tự: ${record.display_order}`
                : ""}
            </Typography.Text>
            <Typography.Text code>
              {record.media_key || "(chưa có key)"}
            </Typography.Text>
          </Space>
        ),
      },
      {
        title: "Mục đích",
        dataIndex: "purpose",
        key: "purpose",
        width: 180,
        render: (value: string) => (
          <Tag color="blue">{PURPOSE_LABEL_MAP.get(value) || value}</Tag>
        ),
      },
      {
        title: "Ngày tạo",
        dataIndex: "created_at",
        key: "created_at",
        width: 190,
        render: (value: string) => new Date(value).toLocaleString("vi-VN"),
      },
      {
        title: "Thao tác",
        key: "actions",
        width: 260,
        render: (_: unknown, record: MediaItem) => (
          <Space wrap>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyText(record.image_url, "Đã copy URL media")}
            >
              Copy URL
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
            >
              Sửa
            </Button>
            <Popconfirm
              title="Xóa media này?"
              description="Thao tác này không thể hoàn tác"
              okText="Xóa"
              cancelText="Hủy"
              onConfirm={() => handleDelete(record.id)}
            >
              <Button size="small" danger icon={<DeleteOutlined />}>
                Xóa
              </Button>
            </Popconfirm>
          </Space>
        ),
      },
    ],
    [messageApi],
  );

  return (
    <div style={{ padding: 24 }}>
      {contextHolder}

      <Typography.Title level={3} style={{ marginTop: 0, marginBottom: 4 }}>
        Quản lý Media
      </Typography.Title>
      <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
        Upload và quản lý ảnh dùng cho logo, favicon, QR chuyển khoản và banner
        trang chủ.
      </Typography.Paragraph>

      <Row gutter={16}>
        <Col xs={24} lg={9}>
          <Card title="Upload media mới" style={{ marginBottom: 16 }}>
            <Form form={uploadForm} layout="vertical" onFinish={handleUpload}>
              <Form.Item
                name="purpose"
                label="Mục đích"
                rules={[{ required: true, message: "Vui lòng chọn mục đích" }]}
              >
                <Select options={PURPOSE_OPTIONS} />
              </Form.Item>

              <Form.Item name="mediaKey" label="Media key (tuỳ chọn)">
                <Input placeholder="vd: site_logo_main" />
              </Form.Item>

              <Form.Item name="altText" label="Alt text (tuỳ chọn)">
                <Input placeholder="Mô tả media" />
              </Form.Item>

              <Form.Item shouldUpdate noStyle>
                {() =>
                  uploadForm.getFieldValue("purpose") === "homepage_banner" ? (
                    <Form.Item
                      name="displayOrder"
                      label="Thứ tự banner"
                      rules={[
                        {
                          required: true,
                          message: "Vui lòng nhập thứ tự banner",
                        },
                      ]}
                    >
                      <InputNumber<number>
                        min={1}
                        style={{ width: "100%" }}
                        placeholder="1, 2, 3..."
                      />
                    </Form.Item>
                  ) : null
                }
              </Form.Item>

              <Form.Item label="File media">
                <Upload.Dragger
                  accept="image/*,video/*"
                  multiple={selectedUploadPurpose === "homepage_banner"}
                  maxCount={
                    selectedUploadPurpose === "homepage_banner"
                      ? undefined
                      : 1
                  }
                  beforeUpload={() => false}
                  fileList={fileList}
                  onChange={(info) => {
                    const isBanner = selectedUploadPurpose === "homepage_banner";
                    setFileList(isBanner ? info.fileList : info.fileList.slice(-1));
                  }}
                  onRemove={() => {
                    setFileList([]);
                    return true;
                  }}
                >
                  <p className="ant-upload-drag-icon">
                    <InboxOutlined />
                  </p>
                  <p className="ant-upload-text">
                    Bấm hoặc kéo thả ảnh vào đây
                  </p>
                  <p className="ant-upload-hint">
                    Logo/Favicon/QR ngân hàng: chỉ ảnh (tối đa 12MB, upload sau
                    sẽ ghi đè). Banner trang chủ: ảnh hoặc video (video tối đa
                    100MB, upload nhiều file được).
                  </p>
                </Upload.Dragger>
                <div
                  onPaste={handlePasteToDragger}
                  tabIndex={0}
                  style={{ marginTop: 8 }}
                  className="inline-flex cursor-text items-center justify-center rounded border border-dashed border-blue-300 bg-blue-50 px-3 py-1 text-xs text-blue-700"
                >
                  Bấm vào vùng này rồi dùng
                  <span className="mx-1 font-semibold">Ctrl+V</span>/
                  <span className="mx-1 font-semibold">Cmd+V</span> để dán ảnh/
                  video từ clipboard (chụp màn hình, copy từ trình duyệt,...).
                </div>
              </Form.Item>

              <Button
                type="primary"
                htmlType="submit"
                loading={uploading}
                block
              >
                Upload
              </Button>
            </Form>
          </Card>

          <Card size="small" title="Cách dùng nhanh">
            <Typography.Text style={{ display: "block" }}>
              - Copy URL trực tiếp để set logo/banner.
            </Typography.Text>
            <Typography.Text style={{ display: "block" }}>
              - Hoặc dùng API: /api/media?key=site_logo_main
            </Typography.Text>
          </Card>
        </Col>

        <Col xs={24} lg={15}>
          <Card
            title="Thư viện media"
            extra={
              <Space>
                <Input.Search
                  allowClear
                  placeholder="Tìm theo tên/key"
                  onSearch={(value) => {
                    setSearch(value);
                    fetchMedia({ q: value });
                  }}
                  style={{ width: 220 }}
                />
                <Select
                  value={purposeFilter}
                  style={{ width: 180 }}
                  options={[
                    { value: "all", label: "Tất cả" },
                    ...PURPOSE_OPTIONS,
                  ]}
                  onChange={(value) => {
                    setPurposeFilter(value);
                    fetchMedia({ purpose: value });
                  }}
                />
                <Button
                  icon={<ReloadOutlined />}
                  onClick={() => fetchMedia()}
                />
              </Space>
            }
          >
            <Table<MediaItem>
              rowKey="id"
              columns={columns}
              dataSource={items}
              loading={loading}
              pagination={{ pageSize: 8 }}
              scroll={{ x: 980 }}
            />
          </Card>
        </Col>
      </Row>

      <Modal
        open={Boolean(editingItem)}
        title="Cập nhật metadata media"
        onCancel={() => setEditingItem(null)}
        onOk={() => editForm.submit()}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={saving}
        okButtonProps={{ icon: <SaveOutlined /> }}
        destroyOnHidden
      >
        <Form form={editForm} layout="vertical" onFinish={handleSaveMetadata}>
          <Form.Item
            name="purpose"
            label="Mục đích"
            rules={[{ required: true, message: "Vui lòng chọn mục đích" }]}
          >
            <Select options={PURPOSE_OPTIONS} />
          </Form.Item>
          <Form.Item name="mediaKey" label="Media key (tuỳ chọn)">
            <Input placeholder="vd: homepage_banner_1" />
          </Form.Item>
          <Form.Item name="altText" label="Alt text (tuỳ chọn)">
            <Input placeholder="Mô tả media" />
          </Form.Item>
          <Form.Item shouldUpdate noStyle>
            {() =>
              editForm.getFieldValue("purpose") === "homepage_banner" ? (
                <Form.Item
                  name="displayOrder"
                  label="Thứ tự banner"
                  rules={[
                    { required: true, message: "Vui lòng nhập thứ tự banner" },
                  ]}
                >
                  <InputNumber<number>
                    min={1}
                    style={{ width: "100%" }}
                    placeholder="1, 2, 3..."
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
