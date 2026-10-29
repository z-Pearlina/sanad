import PageFrame from "@/components/PageFrame";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return <PageFrame>{children}</PageFrame>;
}
