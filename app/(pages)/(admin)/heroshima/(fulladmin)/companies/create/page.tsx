"use client";
import { FormEvent, useEffect, useState } from "react";
import { Globe, Linkedin, Twitter, Facebook, Image as ImageIcon, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from "next-cloudinary";
import Image from "next/image";
import { toast } from "react-toastify";

export default function CreateCompany() {
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [error, setError] = useState<{ logo?: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);

  const [resource, setResource] = useState<string | CloudinaryUploadWidgetInfo | undefined>();

  const { push } = useRouter();

  const handleLogoUpload = (result: any) => {
    setLogo(result.info.secure_url);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formValues = { name, about: about.trim(), logo, website, linkedin, twitter, facebook };
    if (isLoading) return;
    if (!logo) {
      setError((prev) => ({ ...prev, logo: true }));
    }

    setIsLoading(true);
    toast.info("Adding new company...", { autoClose: 300 });

    try {
      const response = await fetch("/api/companies", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formValues),
      });

      if (!response.ok) {
        throw new Error("Network response was not ok");
      }

      const data = await response.json();
      toast.success("Company created successfully!", {
        position: "bottom-right",
        autoClose: 3500,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      push("/heroshima/companies/" + data.data.name);
    } catch (error: any) {
      toast.error(`Failed to create company: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
    // Handle form submission
  };

  useEffect(() => {
    const uploadedString = resource && typeof resource !== "string" ? resource.secure_url : "";
    if (uploadedString) {
      setLogo(uploadedString);
      setError((prev) => ({ ...prev, logo: false }));
    }
  }, [resource]);

  return (
    <div className="w-full h-screen overflow-y-scroll p-4 lg:pr-[5%]">
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
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Enter company description"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary/95 flex items-center">
            <ImageIcon className="mr-2 w-4 h-4 text-primary/50" /> Company Logo
          </label>
          <div className="flex flex-col gap-4 items-start pt-4">
            {logo ? (
              <Image
                src={logo}
                alt="Company Logo"
                width={100}
                height={100}
                className="outline outline-2 outline-gray-300 rounded-md p-1 shadow-md aspect-square w-[10rem]"
              />
            ) : null}
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"] }}
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
              onSuccess={(result, { widget }) => {
                setResource(result?.info);
                handleLogoUpload(result);
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
                    type="button"
                    className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5">
                    {logo ? "Upload another logo" : "Upload logo"}
                  </button>
                );
              }}
            </CldUploadWidget>
            {error.logo ? <p className="text-red-500">Upload a logo to create company</p> : null}
          </div>
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
          />
        </div>
        <div className="flex justify-center">
          <button
            disabled={isLoading}
            type="submit"
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 disabled:opacity-50">
            <Plus className="w-6 h-6 mr-2" />
            Create Company
          </button>
        </div>
      </form>
    </div>
  );
}
