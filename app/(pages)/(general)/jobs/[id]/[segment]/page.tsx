import LandingPage, {
  landingMetadata,
  type LandingProps,
} from "@/app/components/landing/LandingPage";
type Props = LandingProps & {
  params: Promise<{ id: string; segment: string }>;
};
export async function generateMetadata({ params, searchParams }: Props) {
  const { id, segment } = await params;
  return landingMetadata("jobs", `${id}/${segment}`, { searchParams });
}
export default async function Page({ params, searchParams }: Props) {
  const { id, segment } = await params;
  return (
    <LandingPage
      kind="jobs"
      slug={`${id}/${segment}`}
      searchParams={searchParams}
    />
  );
}
