import Image from "next/image";
import React from "react";

const Page = () => {
  return (
    <main>
      <article>
        <header className="mx-auto max-w-screen-xl pt-28 text-center">
          <p className="text-gray-500">Published April 4, 2022</p>
          <h1 className="mt-2 text-3xl font-bold text-gray-900 sm:text-5xl">7 Rules of Effective Marketing</h1>
          <p className="mt-6 text-lg text-gray-700">{`You're doing marketing the wrong way`}</p>

          <div className="mt-6 flex flex-wrap justify-center gap-2" aria-label="Tags">
            <button className="px-2 py-1 text-gray-600 bg-gray-100 font-medium rounded-lg hover:bg-gray-200">Marketing</button>
            <button className="px-2 py-1 text-gray-600 bg-gray-100 font-medium rounded-lg hover:bg-gray-200">Branding</button>
            <button className="px-2 py-1 text-gray-600 bg-gray-100 font-medium rounded-lg hover:bg-gray-200">Digital</button>
            <button className="px-2 py-1 text-gray-600 bg-gray-100 font-medium rounded-lg hover:bg-gray-200">Identity</button>
          </div>

          <Image
            width={1080}
            height={720}
            className="mt-10 w-full object-contain sm:h-[34rem]"
            src="https://images.unsplash.com/photo-1552664730-d307ca884978?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=1170&q=80"
            alt="Featured Image"
          />
        </header>

        <div className="mx-auto mt-10 max-w-screen-md space-y-12 px-4 py-10 font-serif text-lg tracking-wide text-gray-700">
          <strong className="text-2xl font-medium">
            Lorem ipsum dolor sit amet, consectetur adipisicing elit. Maxime impedit ex consequatur nostrum cupiditate at sequi? Ipsam
            commodi modi officia mollitia doloribus tenetur consectetur quae?
          </strong>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Iusto enim maxime sit laudantium! Dolore atque, maxime iusto ut quas
            distinctio reiciendis animi voluptatibus soluta molestias, mollitia officiis laboriosam illum earum.
          </p>
          <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit. Accusamus similique reiciendis et recusandae provident repellendus rem
            doloremque eaque error assumenda?
          </p>
        </div>
      </article>
    </main>
  );
};

export default Page;
