import { FilterProvider } from "@/provider/FilterProvider";
import Client from "../Client";

export default async function Home() {
  const fetchData = new Promise((resolve, reject) => {
    // Simulate an asynchronous operation
    setTimeout(() => {
      const data = { message: "Hello, world!" };
      resolve(data);
    }, 2000);
  });

  await fetchData;
  return (
    <FilterProvider>
      <Client />
    </FilterProvider>
  );
}
