"use client";
import { ChangeEvent, FC, FormEvent, Suspense, useState } from "react";
import { RotateCcwSquareIcon } from "lucide-react";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import { toast } from "react-toastify";
import { updateAuthor } from "@/libs/query";
import { useRouter } from "next/navigation";
import { FormStateAuthor_Client } from "@/types/main";

const UpdateAuthorClient: FC<{ data: FormStateAuthor_Client; id: string }> = ({ data, id }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [formValues, setFormValues] = useState<FormStateAuthor_Client>(data);

  const handleInputChange = (field: keyof FormStateAuthor_Client) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormValues((prev) => ({ ...prev, [field]: e.target.value }));
  };
  const { push } = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    // Validate form inputs
    const requiredFields = ["name", "about", "profileImage"];
    for (const field of requiredFields) {
      if (!formValues[field as keyof FormStateAuthor_Client]) {
        if (field === "profileImage") {
          toast.error(`Please upload a profile image for author.`);
          return;
        }
        toast.error(`Please fill in the ${field}.`);
        return;
      }
    }

    setIsLoading(true);
    toast.info("Creating new Author...", { autoClose: 300 });

    try {
      const author = await updateAuthor(id, { ...formValues });
      if (await author.data) {
        toast.success("Author updated successfully!", {
          position: "bottom-right",
          autoClose: 3500,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
      }
      push("/heroshima/authors/" + (await author.data).slug + "/edit");
    } catch (error: any) {
      if (error.message.includes("Unique constraint failed")) {
        toast.error(`Author name taken, use another`);
      } else {
        toast.error(`Failed to update author: ${error.message}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">Update author information</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary">Name</label>
          <input
            type="text"
            value={formValues.name}
            onChange={handleInputChange("name")}
            placeholder="Enter author name"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">About</label>
          <textarea
            value={formValues.about}
            onChange={handleInputChange("about")}
            placeholder="Enter author bio"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">website</label>
          <input
            type="url"
            value={formValues.website}
            onChange={handleInputChange("website")}
            placeholder="Enter website profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Twitter</label>
          <input
            type="url"
            value={formValues.twitter}
            onChange={handleInputChange("twitter")}
            placeholder="Enter Twitter profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">LinkedIn</label>
          <input
            type="url"
            value={formValues.linkedin}
            onChange={handleInputChange("linkedin")}
            placeholder="Enter LinkedIn profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Instagram</label>
          <input
            type="url"
            value={formValues.instagram}
            onChange={handleInputChange("instagram")}
            placeholder="Enter Instagram profile link"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
          />
        </div>
        <div className=" gap-4 items-center">
          {formValues.profileImage ? (
            <Image
              loading="eager"
              src={formValues.profileImage}
              alt="ddid"
              width={1080}
              height={720}
              className="outline outline-2 outline-gray-300 w-[200px] aspect-square rounded-md p-1 shadow-md mb-2"
            />
          ) : null}
          <Suspense>
            <CldUploadWidget
              options={{ sources: ["local", "url", "unsplash"], folder: "/authors", resourceType: "image", multiple: false }}
              uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
              onSuccess={(result, { widget }) => {
                setFormValues((prev) => ({ ...prev, profileImage: (result?.info as any).secure_url! })); // { public_id, secure_url, etc }
              }}
              onQueuesEnd={(result, { widget }) => {
                widget.close();
              }}>
              {({ open }) => {
                function handleOnClick() {
                  // setFormValues((prev) => ({ ...prev, profileImage: "" }));
                  open();
                }
                return (
                  <button
                    type="button"
                    onClick={handleOnClick}
                    className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5 w-[200px] mb-1">
                    Upload author image
                  </button>
                );
              }}
            </CldUploadWidget>
          </Suspense>
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isLoading}
            className="drop-shadow-secondary2-hover flex items-center transition-all group hover:rounded-mds bg-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md">
            <RotateCcwSquareIcon className="w-6 h-6 mr-2 group-hover:scale-90" />
            Update Author
          </button>
        </div>
      </form>
    </div>
  );
};

export default UpdateAuthorClient;
