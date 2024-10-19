"use client";
import { createContext, useState, ReactNode, useContext } from "react";

interface NavbarContextType {
  isOpen: boolean;
  toggleNavbar: () => void;
  closeNavbar: () => void;
}

const NavbarContext = createContext<NavbarContextType | undefined>(undefined);

export const NavbarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);

  const toggleNavbar = () => {
    setIsOpen((prev) => !prev);
  };

  const closeNavbar = () => {
    setIsOpen(false);
  };

  return <NavbarContext.Provider value={{ isOpen, toggleNavbar, closeNavbar }}>{children}</NavbarContext.Provider>;
};

export const useNavbar = (): NavbarContextType => {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error("useNavbar must be used within a NavbarProvider");
  }
  return context;
};
