"use client";

import { useStore } from "@/store/useStore";
import { fileToBase64 } from "@/lib/utils";

export default function UploadPanel() {
  const { setImage, setLoading, setMermaid, setError, image } = useStore();

  const handleFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      setError("文件大小不能超过 5MB");
      return;
    }

    setImage(file);
    setLoading(true);
    setError(null);

    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mediaType: file.type }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setMermaid(data.mermaid);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="border-r p-4">
      <h2 className="text-lg font-bold mb-4">上传图片</h2>

      <div
        className="border-2 border-dashed rounded p-8 text-center cursor-pointer hover:bg-gray-50"
        onDrop={(e) => {
          e.preventDefault();
          handleFile(e.dataTransfer.files[0]);
        }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => document.getElementById("file")?.click()}
      >
        <p>拖拽或点击上传</p>
        <p className="text-sm text-gray-500 mt-2">支持 PNG/JPG，≤5MB</p>
      </div>
      <input
        id="file"
        type="file"
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
      />
      {image && (
        <img
          src={URL.createObjectURL(image)}
          alt="预览"
          className="mt-4 w-full rounded border object-contain"
        />
      )}
    </div>
  );
}
