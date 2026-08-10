import { DataStreamProvider } from "@/components/chat/data-stream-provider";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <DataStreamProvider>{children}</DataStreamProvider>;
}
