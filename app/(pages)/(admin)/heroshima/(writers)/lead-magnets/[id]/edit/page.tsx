import { redirect } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/heroshima/conversions/lead-magnet/${id}/edit`);
}
