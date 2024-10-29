import Header from "@/app/components/Header";
import JobTile from "@/app/components/main/JobTile";

export default function Home() {
  return (
    <div>
      <Header />
      <br />
      <section className="w-full max-w-[1200px] m-auto px-3 lg:px-0">
        <h2 className="text-2xl md:text-3xl font-bold">Explore latest and exiciting jobs now</h2>
        <br />

        {Array(10)
          .fill(0)
          .map((_, index) => (
            <JobTile key={index} />
          ))}
        <div className="w-full flex justify-center">
          <button className="bg-secondary text-primary px-16 py-3 text-lg font-bold hover:rounded-lg">View all jobs</button>
        </div>
      </section>
      <br />
    </div>
  );
}
