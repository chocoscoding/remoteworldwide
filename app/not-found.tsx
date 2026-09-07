import ErrorScreen from "@/app/components/ErrorScreen";

const NotFound = () => <ErrorScreen digits={["4", "4"]} title="Page not found" message="The page you are looking for was moved, renamed, or never existed." />;

export default NotFound;
