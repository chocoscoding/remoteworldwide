import Image from "next/image";
import Link from "next/link";
import React from "react";
import LogoMini from "../svg/LogoMini";
import { InstagramIcon } from "@/components/ui/instagram-icon";
import { FaTelegram } from "react-icons/fa6";
import { LinkedInIcon } from "@/components/ui/linkedin-icon";
import { TwitterIcon } from "@/components/ui/twitter-icon";

const links = [
  {
    title: "Find Jobs",
    href: "/jobs",
  },
  {
    title: "Companies",
    href: "/companies",
  },
  {
    title: "Blogs",
    href: "/blogs",
  },
  {
    title: "Privacy Policy",
    href: "/privacy-policy",
  },
];

const FooterSection = () => {
  return (
    <footer className=" w-full">
      <div className="mx-auto max-w-5xl px-6">
        <Link href="/" aria-label="go home" className="mx-auto block size-fit">
          <LogoMini width={35} height={35} className="w-full !h-auto block sm:hidden" />
        </Link>

        <div className="my-6 flex flex-wrap justify-center gap-6 text-sm">
          {links.map((link, index) => (
            <Link key={index} href={link.href} className="text-muted-foreground hover:text-white duration-150">
              <span>{link.title}</span>
            </Link>
          ))}
        </div>
        <div className="my-6 flex flex-wrap justify-center gap-6 text-sm">
          <Link
            href="https://x.com/W0rldwideremote"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="X/Twitter"
            className="text-muted-foreground hover:text-white">
            <TwitterIcon size={24} />
          </Link>
          <Link href="#" target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" className="text-muted-foreground hover:text-white">
            <LinkedInIcon size={24} />
          </Link>
          <Link
            href="https://t.me/worldwideremote"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Telegram"
            className="text-muted-foreground hover:text-white">
            <FaTelegram size={24} />
          </Link>
          <Link
            href="https://www.instagram.com/remoteworldwide_/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="text-muted-foreground hover:text-white">
            <InstagramIcon size={24} />
          </Link>
          <Link
            href="https://www.tiktok.com/@worldwideremote"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="text-muted-foreground hover:text-white">
            <svg className="size-6" xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M16.6 5.82s.51.5 0 0A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6c0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64c0 3.33 2.76 5.7 5.69 5.7c3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48"></path>
            </svg>
          </Link>
        </div>
        <span className="text-muted-foreground block text-center text-sm">2024 - {new Date().getFullYear()} Worldwideremote</span>
      </div>
    </footer>
  );
};

const Footer = () => {
  return (
    <footer className="bg-primary relative overflow-hidden p-5 z-10">
      <div className="absolute h-[120px] md:h-[200px] w-[120px] md:w-[200px] top-5 left-5 flex opacity-70 md:opacity-100 z-[3]">
        <Image src={`/images/Vector.png`} alt="kdkd" width={150} height={150} />
        <Image src={`/images/star.png`} alt="kdkd" width={40} height={40} className="h-max" />
      </div>
      <div className="absolute h-[120px] md:h-[200px] w-[120px] md:w-[200px] bottom-10 right-5 flex opacity-70 md:opacity-100 z-[3] items-end gap-2">
        <Image src={`/images/Vector.png`} alt="kdkd" width={150} height={150} />
      </div>

      <div className="w-full flex items-center text-white flex-col z-10 relative item justify-between h-full mt-2">
        <div className="w-full h-full flex flex-col items-center gap-1">
          <h3 className="w-fit text-clamp2">Get that unfair advantage! ✨</h3>
          <p className="text-lg w-[90%] max-w-[500px] text-center font-thin">
            Join our Telegram group to skip website distractions and receive daily job updates straight to your feed!
          </p>
          <Link
            href={"https://t.me/worldwideremote"}
            target="_blank"
            className="bg-white text-primary px-5 py-4 mt-6 rounded-md drop-shadow-primary2-hover transition-all font-bold">
            JOIN NOW!
          </Link>
        </div>
        <hr className="w-full border-white/20 justify-self-end mt-8 mb-4" />
        <FooterSection />
      </div>
    </footer>
  );
};

export default Footer;
