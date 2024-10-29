"use client"; // Since we are using React state

import { useNavbar } from "@/provider/NavbarContext";
import Link from "next/link"; // Use Next.js' Link for navigation

const Navbar = () => {
  const { isOpen, toggleNavbar, closeNavbar } = useNavbar();

  return (
    <nav className="bg-white border-b border-gray-200 sticky z-20 top-0">
      <div className="max-w-[1580px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <p className="text-2xl font-bold">Logo</p>
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

            <button className="px-5 py-2 bg-black text-white font-bold">Login</button>

            <div className="relative">
              <img
                src="/path/to/user-image.jpg"
                alt="User"
                className="w-8 h-8 rounded-full cursor-pointer"
                onClick={toggleNavbar} // Assuming toggleNavbar will handle the modal visibility
              />

              {isOpen && (
                <div className="fixed right-2 mt-2 top-16 w-48 bg-white border border-gray-200 rounded-md shadow-lg z-20">
                  <Link href="/bookmarks">
                    <p onClick={closeNavbar} className="block px-4 py-3 text-gray-700 hover:bg-gray-100">
                      Bookmarks
                    </p>
                  </Link>
                  <button
                    onClick={() => {
                      closeNavbar();
                      // Add your logout logic here
                    }}
                    className="block w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-100">
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu Toggle (Hamburger Icon) */}
          <div className="md:hidden flex items-center">
            <button onClick={toggleNavbar} className="text-gray-700 hover:text-gray-900 focus:outline-none">
              {isOpen ? (
                <p className="h-6 w-6" aria-hidden="true">
                  l
                </p> // Close icon when menu is open
              ) : (
                <p className="h-6 w-6" aria-hidden="true">
                  open
                </p> // Hamburger icon when menu is closed
              )}
            </button>
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
