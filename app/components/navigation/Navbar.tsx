"use client"; // Since we are using React state
import { useNavbar } from "@/provider/NavbarContext";
import { useAuthModal } from "@/app/components/auth/AuthModalProvider";
import Link from "next/link"; // Use Next.js' Link for navigation
import { useSession } from "next-auth/react";
import { signOut } from "@/app/lib/authClient";
import Image from "next/image";
import { LoaderCircle, Menu, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import LogoFull from "../svg/LogoFull";
import LogoMini from "../svg/LogoMini";
import { cn } from "@/app/lib/utils";
const Navbar = () => {
  const pathname = usePathname();
  const { status, data } = useSession();
  const { isOpen, toggleNavbar, closeNavbar, isOpen2, toggleNavbar2, closeNavbar2 } = useNavbar();
  const { openAuthModal } = useAuthModal();
  const { replace } = useRouter();
  const User = () => (
    <>
      {status === "unauthenticated" ? (
        <button
          onClick={() => openAuthModal("login")}
          className="p-1.5 px-6 gap-2 transition-all rounded-md bg-primary text-white flex items-center">
          <span>Sign In</span>
        </button>
      ) : null}
      {status === "loading" ? <LoaderCircle className="gap-2  text-primary" /> : null}

      {status === "authenticated" ? (
        <div className="relative">
          <Image
            width={50}
            height={50}
            src={data.user?.image ?? "/images/noimage.png"}
            alt="User"
            className="w-10 h-10 border-2 rounded-full cursor-pointer"
            onClick={toggleNavbar2} // Assuming toggleNavbar will handle the modal visibility
          />

          {isOpen2 && (
            <div className="fixed right-2 mt-2 top-16 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
              <Link href="/bookmarks" onClick={closeNavbar2} className="block px-4 py-3 text-gray-700 hover:bg-gray-100">
                Bookmarks
              </Link>
              <Link href="/sessions" onClick={closeNavbar2} className="block px-4 py-3 text-gray-700 hover:bg-gray-100">
                Sessions
              </Link>
              {data.user?.role === "AUTHOR" ? (
                <Link href="/heroshima/blogs">
                  <p onClick={closeNavbar2} className="block px-4 py-3 text-gray-700 hover:bg-gray-100">
                    WRITER
                  </p>
                </Link>
              ) : null}
              {data.user?.role === "ADMIN" ? (
                <Link href="/heroshima">
                  <p onClick={closeNavbar2} className="block px-4 py-3 text-gray-700 hover:bg-gray-100">
                    ADMIN
                  </p>
                </Link>
              ) : null}
              <button
                onClick={async () => {
                  closeNavbar2();
                  await signOut();
                  replace("/");
                }}
                className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100">
                Logout
              </button>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
  const colorToShow = (() => {
    const currentPathname = pathname;
    switch (currentPathname) {
      case "/blogs":
        return "bg-white border-white";
      default:
        return "bg-white border-gray-200";
    }
  })();
  return (
    <nav className={cn("border-b sticky z-20 top-0", colorToShow)}>
      <div className="max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/" className="">
              <LogoFull width={230} height={190} className="w-full !h-auto sm:block hidden" />
              <LogoMini width={35} height={35} className="w-full !h-auto block sm:hidden" />
            </Link>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/jobs">
              <p className="text-gray-700 hover:text-gray-900">Find jobs</p>
            </Link>
            <Link href="/companies">
              <p className="text-gray-700 hover:text-gray-900">Companies</p>
            </Link>

            <User />
          </div>

          <div className="md:hidden flex items-center gap-2">
            {/* Mobile Menu Toggle (Hamburger Icon) */}
            <div className="md:hidden flex items-center">
              <button onClick={toggleNavbar} className="text-gray-700 hover:text-gray-900 focus:outline-none">
                {isOpen ? (
                  <p className="h-6 w-6" aria-hidden="true">
                    <X />
                  </p> // Close icon when menu is open
                ) : (
                  <p className="h-6 w-6" aria-hidden="true">
                    <Menu />
                  </p> // Hamburger icon when menu is closed
                )}
              </button>
            </div>
            <div className="">
              <User />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1">
            <Link href="/jobs">
              <p onClick={closeNavbar} className="block px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-gray-50">
                Find jobs
              </p>
            </Link>
            <Link href="/companies">
              <p onClick={closeNavbar} className="block px-3 py-2 rounded-md text-base font-medium text-primary hover:bg-gray-50">
                Companies
              </p>
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
