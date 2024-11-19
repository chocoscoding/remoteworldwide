import NotFound from "@/app/components/NotFound";
import EditCompanyClient from "./Client";

export default async function Page() {
  return (
    <>
      <NotFound buttonType="link" title="Company" link="/heroshima/companies/create" />
      {/* <EditCompanyClient /> */}
    </>
  );
}
