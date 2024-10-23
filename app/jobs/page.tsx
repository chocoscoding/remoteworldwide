import JobTile from "../components/jobs/JobTile";
import SearchBar from "../components/SearchBar";
import FilterSection from "../components/FilterSection";

export default function Home() {
  return (
    <div className="p-10">
      {/* search */}

      {/* section */}
      {/* |- list */}
      {/* |- filter that is fixed on scroll */}
      <h2 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exiciting jobs now</h2>
      <br />
      <div className="w-full max-w-[1500px] mb-28">
        <SearchBar />
      </div>

      <section className="w-full px-1 flex gap-20 relative">
        <section className="w-9/12 max-w-[1300px] m-auto px-3 lg:px-0">
          <div className="mb-5">
            <p className="text-2xl font-extralight text-gray-400 mb-2">
              <span className="font-bold text-primary">Job Opportunities</span> {`(205)`}
            </p>
            <hr />
          </div>
          {Array(25)
            .fill(null)
            .map((_, index) => (
              <JobTile key={index} />
            ))}
        </section>
        <FilterSection />
      </section>
      <br />
    </div>
  );
}
