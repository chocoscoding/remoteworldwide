"use client";
import { FormEvent, useState } from "react";
import { Globe, Linkedin, Twitter, Facebook, Image as ImageIcon, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from "next-cloudinary";
import Image from "next/image";

export default function CreateCompany() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState(null);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");

  const [resource, setResource] = useState<string | CloudinaryUploadWidgetInfo | undefined>();

  const { push } = useRouter();

  const handleLogoUpload = (result: any) => {
    setLogo(result.info.secure_url);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const formValues = { name, description, logo, website, linkedin, twitter, facebook };
    // Handle form submission
    console.log(formValues);
  };

  return (
    <div className="w-11/12 h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Company</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className=" text-sm font-medium text-primary/95 flex items-center">Company Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter company name"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary/95 flex items-center">Company Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter company description"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/95 flex items-center">
            <ImageIcon className="mr-2 w-4 h-4 text-primary/50" /> Company Logo
          </label>
          <div className="flex gap-4 items-center">
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"] }}
              uploadPreset="99090"
              onSuccess={(result, { widget }) => {
                setResource(result?.info); // { public_id, secure_url, etc }
              }}
              onQueuesEnd={(result, { widget }) => {
                widget.close();
              }}>
              {({ open }) => {
                function handleOnClick() {
                  setResource(undefined);
                  open();
                }
                return (
                  <button
                    onClick={handleOnClick}
                    className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5">
                    Upload an Image
                  </button>
                );
              }}
            </CldUploadWidget>
            <Image
              src={`/images/telegram.png`}
              alt="ddid"
              width={100}
              height={100}
              className="outline outline-2 outline-gray-300 rounded-md p-1 shadow-md "
            />
          </div>
          {logo && (
            <div className="mt-2">
              <img src={logo} alt="Company Logo" className="w-32 h-32 object-cover" />
            </div>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/95 flex items-center">
            <Globe className="mr-2 w-4 h-4 text-primary/50" /> Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Enter website URL"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/95 flex items-center">
            <Linkedin className="mr-2 w-4 h-4 text-primary/50" /> LinkedIn
          </label>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="Enter LinkedIn URL"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/95 flex items-center">
            <Twitter className="mr-2 w-4 h-4 text-primary/50" /> Twitter
          </label>
          <input
            type="url"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="Enter Twitter URL"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="text-sm font-medium text-primary/95 flex items-center">
            <Facebook className="mr-2 w-4 h-4 text-primary/50" /> Facebook
          </label>
          <input
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="Enter Facebook URL"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3">
            <Plus className="w-6 h-6 mr-2" />
            Create Company
          </button>
        </div>
      </form>
    </div>
  );
}
