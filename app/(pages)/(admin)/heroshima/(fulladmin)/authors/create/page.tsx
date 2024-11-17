"use client";
import { FormEvent, Suspense, useState } from "react";
import { PlusCircle } from "lucide-react";
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from "next-cloudinary";
import Image from "next/image";

export default function CreateBlog() {
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [socialLinks, setSocialLinks] = useState({
    facebook: "",
    twitter: "",
    linkedin: "",
    instagram: "",
  });
  const [profileImage, setProfileImage] = useState<string | CloudinaryUploadWidgetInfo | undefined>();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const formValues = { name, about, socialLinks, profileImage };
    // Handle form submission
    console.log(formValues);
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Author</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter author name"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">About</label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Enter author bio"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Facebook</label>
          <input
            type="url"
            value={socialLinks.facebook}
            onChange={(e) => setSocialLinks({ ...socialLinks, facebook: e.target.value })}
            placeholder="Enter Facebook profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Twitter</label>
          <input
            type="url"
            value={socialLinks.twitter}
            onChange={(e) => setSocialLinks({ ...socialLinks, twitter: e.target.value })}
            placeholder="Enter Twitter profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">LinkedIn</label>
          <input
            type="url"
            value={socialLinks.linkedin}
            onChange={(e) => setSocialLinks({ ...socialLinks, linkedin: e.target.value })}
            placeholder="Enter LinkedIn profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Instagram</label>
          <input
            type="url"
            value={socialLinks.instagram}
            onChange={(e) => setSocialLinks({ ...socialLinks, instagram: e.target.value })}
            placeholder="Enter Instagram profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div className=" gap-4 items-center">
          <Image
            src={`/images/telegram.png`}
            alt="ddid"
            width={1080}
            height={720}
            className="outline outline-2 outline-gray-300 w-1/12 aspect-square rounded-md p-1 shadow-md mb-2"
          />
          <Suspense>
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"] }}
              uploadPreset="99090"
              onSuccess={(result, { widget }) => {
                setProfileImage(result?.info); // { public_id, secure_url, etc }
              }}
              onQueuesEnd={(result, { widget }) => {
                widget.close();
              }}>
              {({ open }) => {
                function handleOnClick() {
                  setProfileImage(undefined);
                  open();
                }
                return (
                  <button
                    onClick={handleOnClick}
                    className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5 w-6/12 mb-1">
                    Upload cover Image
                  </button>
                );
              }}
            </CldUploadWidget>
          </Suspense>
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3">
            <PlusCircle className="w-6 h-6 mr-2" />
            Create Author
          </button>
        </div>
      </form>
    </div>
  );
}
