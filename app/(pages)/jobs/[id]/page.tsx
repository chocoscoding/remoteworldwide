"use client";
import BookmarkStatus from "@/app/components/main/BookmarkStatus";
import { ArrowLeft, Calendar, ChartNoAxesColumnIncreasing, Link, MapPinned, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import React from "react";

const Page = () => {
  const router = useRouter();
  return (
    <main className="min-h-screen">
      <section className="w-full m-auto max-w-[1400px] min-h-screen my-5 p-3">
        {/* back buttton */}
        <div className="flex gap-2 w-fit items-center mb-5" onClick={router.back}>
          <ArrowLeft className="w-4" />
          <p className="font-bold">Back</p>
        </div>

        {/* main section */}
        <section className="grid grid-cols-1 md:grid-cols-10 h-full w-full gap-5 md:gap-10">
          {/* |-job info */}
          <div className="col-span-full md:col-span-7 h-fit">
            <div className="bg-white w-full min-h-screen rounded-lg drop-shadow-primary outline outline-2 outline-black p-10">
              <p className="text-gray-500 text-sm">Job Description</p>

              <section className="mt-5 flex">
                <div>
                  <p className="font-semibold text-3xl mb-3">Fullstack web developer at ConsensysFullstack web developer at Consensys</p>
                  <div className="w-full flex flex-wrap gap-5 mb-3">
                    <p className="text-gray-500 text-lg flex flex-shrink-0 items-center gap-1.5">
                      <MapPinned className="w-4 text-gray-400" />
                      <span>Remote, EMEA</span>
                    </p>
                    <p className="text-gray-500 text-lg flex flex-shrink-0 items-center gap-1.5">
                      <Calendar className="w-4 text-gray-400" />
                      <span>Full-time</span>
                    </p>
                    <p className="text-gray-500 text-lg flex flex-shrink-0 items-center gap-1.5">
                      <ChartNoAxesColumnIncreasing className="w-4 text-gray-400" />
                      <span>Mid-level</span>
                    </p>
                  </div>
                </div>
                <div className="flex justify-end gap-3 flex-shrink-0 w-fit">
                  <button className="h-8 w-8 rounded-lg hover:bg-gray-50 flex items-center justify-center">
                    <Link className="text-gray-500 w-[1.2rem]" />
                  </button>
                  <BookmarkStatus />
                </div>
              </section>
              <hr className="bg-gray-500 my-6" />
              <section className="middle">
                <div className="">
                  <h2 className="text-xl font-medium mb-2">Overview</h2>
                  <p className="mb-6">
                    Mailchimp is on a major mission to revolutionize how designers build their careers. Since day 1, our goal has been to
                    create a gamified learning experience, and now we’re taking the mission to help designers around the world test their
                    skills, build an amazing profile, and get hired. With more than 120K users from more than 150 countries, we’re a
                    fast-growing remote team based in the USA and Europe.
                  </p>

                  <h2 className="text-xl font-medium mb-2">Job Responsibilities</h2>
                  <ul className="list-disc list-inside pl-3 mb-6">
                    <li>Develop and maintain web applications using React and Node.js.</li>
                    <li>Collaborate with cross-functional teams to define, design, and ship new features.</li>
                    <li>Write clean, maintainable, and efficient code.</li>
                    <li>Participate in code reviews and provide constructive feedback.</li>
                    <li>Stay up-to-date with the latest industry trends and technologies.</li>
                  </ul>

                  <h2 className="text-xl font-medium mb-2">Requirements</h2>
                  <ul className="list-disc list-inside pl-3 mb-6">
                    <li>3+ years of experience in full-stack web development.</li>
                    <li>Proficiency in JavaScript, React, and Node.js.</li>
                    <li>Experience with RESTful APIs and GraphQL.</li>
                    <li>Strong understanding of HTML, CSS, and JavaScript.</li>
                    <li>Excellent problem-solving skills and attention to detail.</li>
                  </ul>

                  <h2 className="text-xl font-medium mb-2">Benefits</h2>
                  <ul className="list-disc list-inside pl-3">
                    <li>Competitive salary and equity options.</li>
                    <li>Flexible working hours and remote work opportunities.</li>
                    <li>Health, dental, and vision insurance.</li>
                    <li>Generous paid time off and holidays.</li>
                    <li>Professional development opportunities.</li>
                  </ul>
                </div>
              </section>
              <button className="bg-primary text-white w-full h-12 text-lg flex justify-center gap-3 items-center hover:rounded-lg transition-all mt-5">
                <Zap />
                <span className="font-bold">Apply Now</span>
              </button>
            </div>
          </div>
          {/* |-company info */}
          <div className="col-span-full -order-1 md:order-2 md:col-span-3 h-fit">
            <div className="border-2 border-black h-[300px] rounded-lg md:aspect-square w-full md:w-auto drop-shadow-secondary bg-white"></div>
          </div>
        </section>
      </section>
    </main>
  );
};

export default Page;
