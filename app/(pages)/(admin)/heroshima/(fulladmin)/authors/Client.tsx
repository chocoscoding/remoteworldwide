"use client";

import { AuthorListChildType } from "@/types/main";
import Image from "next/image";
import Link from "next/link";
import { FC, useEffect, useState } from "react";

const AllAuthorsPage: FC<{ data: AuthorListChildType[] }> = ({ data }) => {
  const [authorList, setAuthorList] = useState(data);

  return (
    <div className="w-full h-screen overflow-y-scroll">
      <main className="p-4">
        <h1 className="text-2xl font-bold mb-4">Authors</h1>
        <section className="mb-8">
          {/* list of authors */}
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {authorList.map((author, index) => (
              <li key={index} className="max-w-[700px]">
                <Link href={`/heroshima/authors/${author.slug}`} className="mb-4 flex items-center shadow-md rounded-md p-3 my-2 border">
                  <Image
                    width={100}
                    height={100}
                    src={author.profileImage}
                    alt={author.name}
                    className="w-20 h-20 border-2 rounded-full mr-4"
                  />
                  <div>
                    <p className="text-lg font-semibold">{author.name}</p>
                    <p className="text-sm text-gray-500">{author.about}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default AllAuthorsPage;
