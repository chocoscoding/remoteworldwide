"use client";
import { FormEvent, useState } from "react";
import dynamic from "next/dynamic";
import { PlusCircle } from "lucide-react";
import { CldUploadWidget, CloudinaryUploadWidgetInfo } from "next-cloudinary";
import Image from "next/image";
import Select from "react-select";

const ReactQuill = dynamic(() => import("react-quill"), { ssr: false });

export default function CreateBlog() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [text, setText] = useState("");
  const [author, setAuthor] = useState({ value: "john", label: "John" });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const formValues = { title, description, tags, text };
    // Handle form submission
    console.log(formValues);
  };

  const Authors = [
    { value: "john", label: "John" },
    { value: "carry", label: "Cari" },
    { value: "sally", label: "Sally" },
  ];
  const [resource, setResource] = useState<string | CloudinaryUploadWidgetInfo | undefined>();

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
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Enter tags separated by commas"
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
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
            options={Authors}
            placeholder="Select Author"
            className="mt-1"
            required
          />
        </div>
        <div className=" gap-4 items-center">
          <Image
            src={`/images/telegram.png`}
            alt="ddid"
            width={1080}
            height={720}
            className="outline outline-2 outline-gray-300 w-6/12 aspect-video rounded-md p-1 shadow-md mb-2"
          />
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
            className="drop-shadow-secondary2-hover flex items-center transition-all bg-white text-base border-2 border-primary font-bold rounded-sm p-3">
            <PlusCircle className="w-6 h-6 mr-2" />
            Submit
          </button>
        </div>
      </form>
    </div>
  );
}
