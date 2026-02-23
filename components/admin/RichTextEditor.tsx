"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Image, Modal, Space, Tag, Typography, message } from "antd";
import {
  BoldOutlined,
  ItalicOutlined,
  UnderlineOutlined,
  OrderedListOutlined,
  UnorderedListOutlined,
  LinkOutlined,
  PictureOutlined,
  CodeOutlined,
  FontSizeOutlined,
} from "@ant-design/icons";

interface ProductMediaImage {
  id: string;
  url: string;
  isCover?: boolean;
}

interface RichTextEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  productMediaImages?: ProductMediaImage[];
}

export function RichTextEditor({
  value,
  onChange,
  placeholder,
  minHeight = 260,
  productMediaImages = [],
}: RichTextEditorProps) {
  const [messageApi, contextHolder] = message.useMessage();
  const [isHtmlMode, setIsHtmlMode] = useState(false);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current || isHtmlMode) return;
    const nextValue = value || "";
    if (editorRef.current.innerHTML !== nextValue) {
      editorRef.current.innerHTML = nextValue;
    }
  }, [value, isHtmlMode]);

  const emitChange = (nextValue: string) => {
    onChange?.(nextValue);
  };

  const handleInput = () => {
    emitChange(editorRef.current?.innerHTML || "");
  };

  const runCommand = (command: string, commandValue?: string) => {
    if (isHtmlMode) return;
    editorRef.current?.focus();
    document.execCommand(command, false, commandValue);
    handleInput();
  };

  const escapeHtmlAttribute = (value: string): string => {
    return value
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  };

  const insertResizableImage = (url: string) => {
    if (isHtmlMode) return;
    const trimmedUrl = url.trim();
    if (!trimmedUrl) return;

    editorRef.current?.focus();

    const safeUrl = escapeHtmlAttribute(trimmedUrl);
    const imageHtml = `
      <div class="sl-rte-image-wrapper" contenteditable="false" style="display:inline-block;resize:both;overflow:auto;max-width:100%;width:min(360px,100%);min-width:96px;border:1px solid #d9d9d9;border-radius:8px;vertical-align:top;">
        <img src="${safeUrl}" alt="" style="display:block;width:100%;height:auto;border-radius:8px;" />
      </div>
      <p><br></p>
    `;

    document.execCommand("insertHTML", false, imageHtml);
    handleInput();
  };

  const insertLink = () => {
    const url = window.prompt("Nhập URL liên kết");
    if (!url) return;
    runCommand("createLink", url);
  };

  const insertImageByUrl = () => {
    const url = window.prompt("Nhập URL hình ảnh");
    if (!url) return;
    insertResizableImage(url);
  };

  const openMediaPicker = () => {
    if (productMediaImages.length === 0) {
      messageApi.info("Sản phẩm chưa có ảnh media để chèn");
      return;
    }

    setIsMediaModalOpen(true);
  };

  const insertImageFromMedia = (url: string) => {
    insertResizableImage(url);
    setIsMediaModalOpen(false);
  };

  return (
    <div>
      {contextHolder}
      <Space wrap style={{ marginBottom: 8 }}>
        <Button
          icon={<BoldOutlined />}
          onClick={() => runCommand("bold")}
          disabled={isHtmlMode}
        />
        <Button
          icon={<ItalicOutlined />}
          onClick={() => runCommand("italic")}
          disabled={isHtmlMode}
        />
        <Button
          icon={<UnderlineOutlined />}
          onClick={() => runCommand("underline")}
          disabled={isHtmlMode}
        />
        <Button
          icon={<FontSizeOutlined />}
          onClick={() => runCommand("formatBlock", "<h2>")}
          disabled={isHtmlMode}
        >
          H2
        </Button>
        <Button
          icon={<UnorderedListOutlined />}
          onClick={() => runCommand("insertUnorderedList")}
          disabled={isHtmlMode}
        />
        <Button
          icon={<OrderedListOutlined />}
          onClick={() => runCommand("insertOrderedList")}
          disabled={isHtmlMode}
        />
        <Button
          icon={<LinkOutlined />}
          onClick={insertLink}
          disabled={isHtmlMode}
        >
          Link
        </Button>
        <Button
          icon={<PictureOutlined />}
          onClick={insertImageByUrl}
          disabled={isHtmlMode}
        >
          Ảnh URL
        </Button>
        <Button
          icon={<PictureOutlined />}
          onClick={openMediaPicker}
          disabled={isHtmlMode}
        >
          Ảnh từ media
        </Button>
        <Button
          icon={<CodeOutlined />}
          type={isHtmlMode ? "primary" : "default"}
          onClick={() => setIsHtmlMode((prev) => !prev)}
        >
          HTML
        </Button>
      </Space>

      <Modal
        title="Chọn ảnh từ media sản phẩm"
        open={isMediaModalOpen}
        onCancel={() => setIsMediaModalOpen(false)}
        footer={null}
        width={760}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: 12,
          }}
        >
          {productMediaImages.map((media) => (
            <button
              key={media.id}
              type="button"
              onClick={() => insertImageFromMedia(media.url)}
              style={{
                border: "1px solid #d9d9d9",
                borderRadius: 8,
                padding: 8,
                background: "#fff",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <Image
                src={media.url}
                alt="media"
                width="100%"
                height={92}
                style={{ objectFit: "cover", borderRadius: 6 }}
                preview={false}
              />
              {media.isCover && (
                <Tag color="blue" style={{ marginTop: 8, marginInlineEnd: 0 }}>
                  Cover
                </Tag>
              )}
            </button>
          ))}
        </div>
      </Modal>

      {isHtmlMode ? (
        <textarea
          value={value || ""}
          onChange={(event) => emitChange(event.target.value)}
          style={{
            width: "100%",
            minHeight,
            resize: "vertical",
            border: "1px solid #d9d9d9",
            borderRadius: 8,
            padding: 12,
            fontFamily: "monospace",
            fontSize: 13,
          }}
          placeholder={placeholder}
        />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          style={{
            minHeight,
            border: "1px solid #d9d9d9",
            borderRadius: 8,
            padding: 12,
            background: "#fff",
            overflow: "auto",
          }}
        />
      )}

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        Hỗ trợ nhập thẻ HTML, danh sách, liên kết và ảnh (URL hoặc từ media sản
        phẩm).
      </Typography.Text>
    </div>
  );
}
