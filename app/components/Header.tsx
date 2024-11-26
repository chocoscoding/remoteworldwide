"use client";
import React, { Suspense } from "react";
import Globe from "./Globe";
import { DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG } from "@/app/components/svg";
import SearchBar from "./SearchBar";
import Image from "next/image";

const Companies = [DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG];
const Header = ({ count }: { count: number | null }) => {
  return (
    <div className="relative border-b">
      <section className="w-full h-screen sm:max-h-[600px] max-h-[550px] lg:max-h-[650px] border-none relative right-0">
        <div className="w-full h-full relative overflow-hidden">
          <Globe />
          <Image
            src={"/globe.png"}
            width={720}
            height={720}
            alt="globe fallback"
            className="h-auto w-full md:w-auto md:h-full md:aspect-auto -bottom-14 md:bottom-0 absolute -right-4 md:scale-90"
            id="fallbackglobe"
          />
        </div>
      </section>
      <section className="w-full h-full z-10 absolute top-0 left-0 flex flex-col px-2.5 sm:px-5 md:px-10 pt-5 sm:pt-7 md:pt-12 bg-transparent overflow-hidden">
        <p className="bg-gray-200 w-fit p-2.5 md:p-3 text-xs rounded-full md:text-sm">{count ?? "100"} open positions today 🔥</p>
        <h1 className="font-bold max-w-[550px] mt-4 mb-3 text-clamp1">Find your next remote job</h1>
        <h3 className="text-gray-700 max-w-[500px] mb-5 text-sm xs:text-base">
          Discover verified worldwide remote roles. Confidently apply to roles that fit your location, skills, and ambition-No surprises,
          just opportunities that want you.
        </h3>
        <div className="w-[98%] max-w-[1000px]">
          <Suspense>
            <SearchBar />
          </Suspense>
        </div>
        <section className="mt-6 md:mt-8 flex flex-col justify-start">
          <p className="mb-2 text-gray-600 ">Jobs from the top remote companies</p>
          <div className="flex flex-wrap gap-2 xxs:gap-4">
            {Companies.map((Company, index) => (
              <div className="w-[70px] xxs:w-[85px] sm:w-[90px] xl:w-[100px]" key={index}>
                <Company />
              </div>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
};

export default Header;
