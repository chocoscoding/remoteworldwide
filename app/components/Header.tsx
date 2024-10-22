"use client";
import React from "react";
import Globe from "./Globe";
import { DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG } from "@/app/components/svg";
import SearchBar from "./SearchBar";

const Companies = [DiscordSVG, PipefySVG, SlackSVG, SpotifySVG, WebflowSVG];
const Header = () => {
  return (
    <div className="relative border-b">
      <section className="w-full h-screen max-h-[600px] lg:max-h-[650px] border-none relative right-0">
        <div className="w-full h-full relative">
          <Globe />
        </div>
      </section>
      <section className="w-full h-full z-10 absolute top-0 left-0 flex flex-col px-10 pt-12 bg-transparent">
        <p className="bg-gray-200 w-fit p-3 text-sm rounded-full ">2886 open positions</p>
        <h1 className="font-bold max-w-[550px] mt-4 mb-3 text-clamp1">Find your next remote job</h1>
        <h3 className="text-gray-700 max-w-[500px] mb-5">
          Lorem ipsum dolor sit amet consectetur adipisicing elit. Officiis dolorem blanditiis porro minima non ex natus in, voluptate
          cupiditate excepturi, enim iste eius quisquam.
        </h3>
        <div className="w-[98%] max-w-[1000px]">
          <SearchBar />
        </div>
        <section className="mt-20">
          <p className="mb-4 text-gray-400 ">Trusted by the top companies</p>
          <div className="flex flex-wrap gap-7">
            {Companies.map((Company, index) => (
              <Company key={index} />
            ))}
          </div>
        </section>
      </section>
    </div>
  );
};

export default Header;
