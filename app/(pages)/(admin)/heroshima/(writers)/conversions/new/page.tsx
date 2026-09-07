import ConversionWizard, { type ConversionType } from "@/app/components/ADMIN/blog/ConversionWizard";

const Page = async ({ searchParams }: { searchParams: Promise<{ type?: string }> }) => {
  const { type } = await searchParams;
  const initial: ConversionType | null = type === "cta" || type === "magnet" ? type : null;
  return <ConversionWizard initial={initial} />;
};

export default Page;
