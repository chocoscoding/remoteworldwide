"use client";

import { FC, FormEvent, ReactNode, useState } from "react";
import { Facebook, Globe, Image as ImageIcon, Linkedin, Twitter } from "lucide-react";
import { CldUploadWidget, CloudinaryUploadWidgetResults } from "next-cloudinary";
import Image from "next/image";
import { toast } from "react-toastify";
import type { Company } from "@prisma/client";
import { cn } from "@/lib/utils";

/**
 * The "create a company" fields + POST, shared by the standalone
 * `/heroshima/companies/create` page and the popup opened from the job forms,
 * so the two can never drift apart.
 */

export interface CompanyFormProps {
  /** Fires with the created company once the API confirms it — the caller decides what happens next. */
  onCreated: (company: Company) => void;
  /** Submit row, rendered at the end of the form so it can read the live loading state. */
  renderActions: (state: { isLoading: boolean }) => ReactNode;
  className?: string;
  /** Classes for the field stack — the popup uses this to cap its height and scroll. */
  fieldsClassName?: string;
  /**
   * Fires while the Cloudinary widget is open. The popup listens so an
   * interaction with the widget — which mounts outside the dialog — doesn't
   * dismiss the dialog underneath it.
   */
  onLogoWidgetOpenChange?: (open: boolean) => void;
}

const LABEL_CLASS = "text-sm font-medium text-primary/95 flex items-center";
const INPUT_CLASS = "mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2";

const CompanyForm: FC<CompanyFormProps> = ({ onCreated, renderActions, className, fieldsClassName, onLogoWidgetOpenChange }) => {
  const [name, setName] = useState("");
  const [about, setAbout] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [website, setWebsite] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [twitter, setTwitter] = useState("");
  const [facebook, setFacebook] = useState("");
  const [error, setError] = useState<{ logo?: boolean }>({});
  const [isLoading, setIsLoading] = useState(false);

  const handleLogoUpload = (result: CloudinaryUploadWidgetResults) => {
    const info = result?.info;
    const secureUrl = info && typeof info !== "string" ? info.secure_url : "";
    if (!secureUrl) return;
    setLogo(secureUrl);
    setError((prev) => ({ ...prev, logo: false }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const formValues = { name: name.trim(), about: about.trim(), logo, website, linkedin, twitter, facebook };
    if (isLoading) return;
    if (!logo) {
      // The API rejects a logo-less company anyway — stop here so the admin
      // gets the inline message instead of a round trip and a toast.
      setError((prev) => ({ ...prev, logo: true }));
      return;
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

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message);
      }

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
      onCreated(data.data as Company);
    } catch (error: any) {
      toast.error(`Failed to create company: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className={cn("space-y-4", fieldsClassName)}>
        <div>
          <label className={LABEL_CLASS}>Company Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter company name"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Company Description</label>
          <textarea
            value={about}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="Enter company description"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>
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
              onOpen={() => onLogoWidgetOpenChange?.(true)}
              onClose={() => onLogoWidgetOpenChange?.(false)}
              onSuccess={(result) => {
                handleLogoUpload(result);
              }}
              onQueuesEnd={(result, { widget }) => {
                widget.close();
                onLogoWidgetOpenChange?.(false);
              }}>
              {({ open }) => {
                function handleOnClick() {
                  // Flagged before `open()` rather than waiting for the widget's
                  // own `onOpen`, so a host that closes on outside interaction
                  // (the popup) knows to stand down before the widget steals focus.
                  onLogoWidgetOpenChange?.(true);
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
          <label className={LABEL_CLASS}>
            <Globe className="mr-2 w-4 h-4 text-primary/50" /> Website
          </label>
          <input
            type="url"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="Enter website URL"
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>
            <Linkedin className="mr-2 w-4 h-4 text-primary/50" /> LinkedIn
          </label>
          <input
            type="url"
            value={linkedin}
            onChange={(e) => setLinkedin(e.target.value)}
            placeholder="Enter LinkedIn URL"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>
            <Twitter className="mr-2 w-4 h-4 text-primary/50" /> Twitter
          </label>
          <input
            type="url"
            value={twitter}
            onChange={(e) => setTwitter(e.target.value)}
            placeholder="Enter Twitter URL"
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>
            <Facebook className="mr-2 w-4 h-4 text-primary/50" /> Facebook
          </label>
          <input
            type="url"
            value={facebook}
            onChange={(e) => setFacebook(e.target.value)}
            placeholder="Enter Facebook URL"
            className={INPUT_CLASS}
          />
        </div>
      </div>
      {renderActions({ isLoading })}
    </form>
  );
};

export default CompanyForm;
