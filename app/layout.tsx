import "./globals.css";

export const metadata = {
  title: "Image to Mermaid",
  description: "Convert images to Mermaid diagrams",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh">
      <body>{children}</body>
    </html>
  );
}
