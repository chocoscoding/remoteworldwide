import NotFound from "@/app/components/NotFound";

// notFound() in page.tsx lands here, so a missing company answers a real 404 (not a 200 Google calls a soft 404).
export default function CompanyNotFound() {
  return <NotFound buttonType="back" title="Company" />;
}
