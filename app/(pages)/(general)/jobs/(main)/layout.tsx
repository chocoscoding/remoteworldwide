import SearchBar from "@/app/components/SearchBar";
import React, { ReactNode } from "react";

const Layout = ({ children }: { children: ReactNode }) => {
  return (
    <main className="p-3 md:p-10 w-full max-w-[1100px] m-auto">
      <h2 className="text-2xl md:text-3xl font-bold text-center">Explore latest and exiciting jobs now</h2>
      <br />
      <div className="w-full max-w-[1500px] mb-20">
        <SearchBar />
      </div>
      {children}
    </main>
  );
};

export default Layout;
