import UploadPanel from "@/components/UploadPanel";
import EditorPanel from "@/components/EditorPanel";
import PreviewPanel from "@/components/PreviewPanel";

export default function Home() {
  return (
    <main className="h-screen grid grid-cols-3">
      <UploadPanel />
      <EditorPanel />
      <PreviewPanel />
    </main>
  );
}
