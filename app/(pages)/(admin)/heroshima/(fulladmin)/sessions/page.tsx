import AdminSessionsClient from "./Client";

// ADMIN role is enforced by the (fulladmin) layout, which calls notFound() for
// anyone else. Intentionally absent from the sidebar — URL access only.
export default function AdminSessionsPage() {
  return <AdminSessionsClient />;
}
