"use client";
import React, { Suspense } from "react";
import Globe from "./Globe";
import { DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG } from "@/app/components/svg";
import SearchBar from "./SearchBar";

const Companies = [DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG];
const Header = ({ count }: { count: number | null }) => {
  return (
    <div className="relative border-b">
      <section className="w-full h-screen sm:max-h-[600px] max-h-[550px] lg:max-h-[650px] border-none relative right-0">
        <div className="w-full h-full relative overflow-hidden">
          <Globe />
        </div>
      </section>
      {/* The content sits 10% of the hero's height lower than before (owner, 2026-11-14): the old top
          padding plus min(10vh, a tenth of the hero's cap), since the hero is the screen's height up to
          550, 600 or 650px. */}
      <section className="w-full h-full z-10 absolute top-0 left-0 flex flex-col px-2.5 sm:px-5 md:px-10 pt-[calc(1.25rem+min(10vh,55px))] sm:pt-[calc(1.75rem+min(10vh,60px))] md:pt-[calc(3rem+min(10vh,60px))] lg:pt-[calc(3rem+min(10vh,65px))] bg-transparent overflow-hidden">
        {count !== null && (
          <span className="bg-gray-200 block w-fit p-2.5 md:p-3 text-xs rounded-full md:text-sm" aria-hidden="true" data-nosnippet>
            {count} open positions 🔥
          </span>
        )}
        {/* Owner, 2026-11-14: one weight, 600, on two lines at every size. The cap is in em, so it follows
            the clamped font size: "Verified remote roles &" is 10.75em, adding "job" would make 12.45em. */}
        <h1 className="font-semibold max-w-[11.5em] mt-4 mb-3 text-clamp1">Verified remote roles &amp; job application tools</h1>
        <h2 className="text-gray-700 max-w-[500px] mb-5 text-sm xs:text-base">
          Remote roles that fit your location and skills, plus the tools to apply with confidence.
        </h2>
        <div className="w-[98%] max-w-[1000px]">
          <Suspense>
            <SearchBar alwaysActive />
          </Suspense>
        </div>
        <section className="mt-6 md:mt-8 flex flex-col justify-start">
          <p className="mb-2 text-gray-600 ">Vetted jobs from companies that hire remotely</p>
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
