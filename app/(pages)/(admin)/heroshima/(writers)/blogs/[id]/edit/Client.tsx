"use client";
import { FC, FormEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from "next-cloudinary";
import Image from "next/image";
import Select from "react-select";
import { Option } from "@/types/main";
import React from "react";
import { toast } from "react-toastify";
import { editBlog } from "@/libs/query";
import { useRouter } from "next/navigation";
import { TagsInput } from "react-tag-input-component";
import { Blog } from "@prisma/client";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

const EditBlogClient: FC<{ authors: Option[]; blog: Blog & { author: { name: string } } }> = ({ authors, blog }) => {
  const [title, setTitle] = useState(blog.title);
  const [description, setDescription] = useState(blog.description);
  const [tags, setTags] = useState<string[]>(blog.tags);
  const [text, setText] = useState(blog.content);
  const [author, setAuthor] = useState<Option>({ value: blog.authorId, label: blog.author.name });
  const [isLoading, setIsLoading] = useState(false);
  const [resource, setResource] = useState<string | CloudinaryUploadWidgetInfo | undefined>();
  const [coverImage, setCoverImage] = useState(blog.coverImage);

  useEffect(() => {
    if (resource && typeof resource !== "string" && resource.secure_url) {
      setCoverImage(resource.secure_url);
    }
  }, [resource]);
  const { push } = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title || !description || !tags || !text || !author || !coverImage) {
      toast.error("Please fill in all fields and upload a cover image.");
      return;
    }
    const formValues = {
      title,
      description,
      tags,
      content: text,
      authorId: author!.value,
      coverImage,
    };

    setIsLoading(true);
    toast.info("Creating new blog...", { autoClose: 300 });

    try {
      const newBlog = await editBlog(blog.id, formValues);
      if (await newBlog.data) {
        toast.success("blog updated successfully!", {
          position: "bottom-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          progress: undefined,
          theme: "dark",
        });
        push("/heroshima/blogs/" + newBlog.data.slug + "/edit");
      }
    } catch (error: any) {
      toast.error(`Failed to create blog: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full h-screen overflow-y-scroll p-4">
      <h1 className="text-2xl font-bold mb-4">Create New Blog</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-primary">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter blog title"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter blog description"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Tags</label>
          <TagsInput
            value={tags}
            placeHolder="Enter tags separated by commas"
            classNames={{ input: "mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2" }}
            onChange={setTags}
            name="tags"
            {...{ required: true }}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-primary">Author</label>
          <Select
            theme={(theme) => ({
              ...theme,
              borderRadius: 6,
              colors: {
                ...theme.colors,
                primary25: "#e5e5e5",
                primary: "black",
              },
            })}
            value={author}
            onChange={(value) => setAuthor(value!)}
            options={authors}
            placeholder="Select Author"
            className="mt-1"
            required
          />
        </div>
        <div className=" gap-4 items-center">
          {coverImage ? (
            <Image
              src={coverImage}
              alt="ddid"
              width={1080}
              height={720}
              className="outline outline-2 outline-gray-300 w-6/12 aspect-video rounded-md p-1 shadow-md mb-2"
            />
          ) : null}
          <CldUploadWidget
            options={{ sources: ["local", "url", "unsplash"], folder: "blogs" }}
            uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
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
                  type="button"
                  onClick={handleOnClick}
                  className="drop-shadow-primary2-hover transition-all bg-black text-base text-white border-2 border-primary font-bold h-10 rounded-sm px-0.5 w-6/12 mb-1">
                  Upload cover Image
                </button>
              );
            }}
          </CldUploadWidget>
        </div>
        <div>
          <label className="block text-sm font-medium text-primary">Text Editor</label>
          <ReactQuill value={text} onChange={setText} placeholder="Enter blog content" className="mt-1" />
        </div>
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isLoading}
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3 hover:rounded-md">
            <PlusCircle className="w-6 h-6 mr-2" />
            Submit
          </button>
        </div>
      </form>
    </div>
  );
};
export default EditBlogClient;
