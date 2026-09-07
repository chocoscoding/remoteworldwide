"use client";

import { Suspense, useState, type ChangeEvent, type FC, type FormEvent } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { CldUploadWidget } from "next-cloudinary";
import { toast } from "react-toastify";
import { Save, UserPlus } from "lucide-react";
import type { Author } from "@/app/lib/blog/types";
import { createMyAuthor, updateMyAuthor, type MyAuthorInput } from "@/libs/blog-admin";
import { ADMIN_HINT, ADMIN_INPUT, ADMIN_LABEL } from "./OfferTargeting";

type Values = { name: string; about: string; profileImage: string; website: string; linkedin: string; twitter: string; instagram: string };

const SOCIALS: { field: keyof Values; label: string; placeholder: string }[] = [
  { field: "website", label: "Website", placeholder: "https://your-site.com" },
  { field: "twitter", label: "X", placeholder: "https://x.com/you" },
  { field: "linkedin", label: "LinkedIn", placeholder: "https://linkedin.com/in/you" },
  { field: "instagram", label: "Instagram", placeholder: "https://instagram.com/you" },
];

const ProfileForm: FC<{ author: Author | null }> = ({ author }) => {
  const router = useRouter();
  const editing = author !== null;
  const [values, setValues] = useState<Values>({
    name: author?.name ?? "",
    about: author?.about ?? "",
    profileImage: author?.profileImage ?? "",
    website: author?.website ?? "",
    linkedin: author?.linkedin ?? "",
    twitter: author?.twitter ?? "",
    instagram: author?.instagram ?? "",
  });
  const [busy, setBusy] = useState(false);

  const onChange = (field: keyof Values) => (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!values.name.trim() || !values.about.trim()) {
      toast.error("Name and about are required.");
      return;
    }
    if (!values.profileImage) {
      toast.error("Upload a profile image.");
      return;
    }
    const payload: MyAuthorInput = {
      name: values.name.trim(),
      about: values.about.trim(),
      profileImage: values.profileImage,
      website: values.website.trim() || null,
      linkedin: values.linkedin.trim() || null,
      twitter: values.twitter.trim() || null,
      instagram: values.instagram.trim() || null,
    };
    setBusy(true);
    try {
      const result = editing ? await updateMyAuthor(payload) : await createMyAuthor(payload);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(editing ? "Profile saved" : "Author profile created");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="w-full p-4" data-profile-form data-mode={editing ? "edit" : "create"}>
      <h1 className="text-2xl font-bold">{editing ? "My author profile" : "Create my author profile"}</h1>
      <p className={ADMIN_HINT}>
        {editing ? "Linked to your account. Ask an admin to change the link." : "Linked to your account automatically — posts you publish are attributed to it first."}
      </p>

      <form onSubmit={submit} className="mt-4 max-w-[720px] space-y-4">
        <div>
          <label className={ADMIN_LABEL}>Name</label>
          <input type="text" value={values.name} onChange={onChange("name")} placeholder="The name readers see" className={ADMIN_INPUT} required />
        </div>
        <div>
          <label className={ADMIN_LABEL}>About</label>
          <textarea value={values.about} onChange={onChange("about")} rows={3} placeholder="A sentence or two readers see under your posts" className={ADMIN_INPUT} required />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {SOCIALS.map((s) => (
            <div key={s.field}>
              <label className={ADMIN_LABEL}>{s.label}</label>
              <input type="url" value={values[s.field]} onChange={onChange(s.field)} placeholder={s.placeholder} className={ADMIN_INPUT} />
            </div>
          ))}
        </div>

        <div className="rounded-md border border-gray-200 p-4">
          <p className="text-sm font-semibold text-primary">Profile image</p>
          <div className="mt-3 flex flex-wrap items-center gap-4">
            {values.profileImage && (
              <Image src={values.profileImage} alt="" width={120} height={120} className="h-[120px] w-[120px] rounded-full border-2 border-primary object-cover" />
            )}
            <Suspense>
              <CldUploadWidget
                options={{ sources: ["local", "url", "unsplash"], folder: "/authors", resourceType: "image", multiple: false }}
                uploadPreset={process.env.NEXT_PUBLIC_CLOUDINARY_PRESET}
                onSuccess={(result) => {
                  const info = result?.info;
                  if (info && typeof info !== "string" && info.secure_url) setValues((prev) => ({ ...prev, profileImage: info.secure_url as string }));
                }}
                onQueuesEnd={(_r, { widget }) => widget.close()}>
                {({ open }) => (
                  <button
                    type="button"
                    onClick={() => open()}
                    className="drop-shadow-primary2-hover h-10 rounded-sm border-2 border-primary bg-black px-4 text-sm font-bold text-white transition-all">
                    {values.profileImage ? "Replace image" : "Upload image"}
                  </button>
                )}
              </CldUploadWidget>
            </Suspense>
          </div>
        </div>

        <div className="flex justify-center">
          <button
            type="submit"
            disabled={busy}
            className="drop-shadow-secondary2-hover flex items-center gap-2 rounded-sm border-2 border-primary bg-white p-3 text-base font-bold transition-all hover:rounded-md disabled:opacity-50">
            {editing ? <Save className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            {busy ? "Saving…" : editing ? "Save profile" : "Create my author profile"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;
