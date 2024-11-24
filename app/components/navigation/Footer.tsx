import Image from "next/image";
import Link from "next/link";
import React from "react";

const Footer = () => {
  return (
    <footer className="bg-primary relative overflow-hidden p-5 z-10">
      <div className="absolute h-[120px] md:h-[200px] w-[120px] md:w-[200px] top-5 left-5 flex opacity-70 md:opacity-100 z-[3]">
        <Image src={`/images/Vector.png`} alt="kdkd" width={150} height={150} />
        <Image src={`/images/star.png`} alt="kdkd" width={40} height={40} className="h-max" />
      </div>
      <div className="absolute h-[120px] md:h-[200px] w-[120px] md:w-[200px] bottom-10 right-5 flex opacity-70 md:opacity-100 z-[3] items-end gap-2">
        <Image src={`/images/Vector.png`} alt="kdkd" width={150} height={150} />
      </div>

      <div className="w-full flex items-center text-white flex-col z-10 relative item justify-between h-full mt-2">
        <div className="w-full h-full flex flex-col items-center gap-1">
          <h3 className="w-fit text-clamp2">Explore a Job Now! ✨</h3>
          <p className="text-lg w-[90%] max-w-[500px] text-center font-thin">
            Worldwideremote is the platform, startups can get assistance with their recruitment of talent as well as connection with
            investors.
          </p>
          <button className="bg-white text-primary px-5 py-4 mt-6 rounded-sm hover:rounded-md drop-shadow-primary2-hover transition-all font-bold">
            Explore Jobs
          </button>
        </div>

        <div className="w-full mt-5">
          <hr className="w-full border-white/50 justify-self-end mb-2" />
          <div className="flex w-full justify-center sm:justify-between flex-wrap text-white/60">
            <div className="flex flex-1 max-w-[700px] gap-10 flex-wrap">
              <p className="font-extralight text-white/30">2024 Worldwideremote</p>
              <div className="flex gap-5 flex-wrap">
                <Link className="flex-shrink-0" href={"/jobs"}>
                  Find Jobs
                </Link>
                <Link className="flex-shrink-0" href={"/companies"}>
                  Companies
                </Link>
                <Link className="flex-shrink-0" href={"/blogs"}>
                  Blogs
                </Link>
              </div>
              <div className="flex gap-6 shrink-0">
                <Link href={"/privacy-policy"}>Privacy Policy</Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
