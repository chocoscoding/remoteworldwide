"use client";
import { createContext, useState, ReactNode, useContext } from "react";

interface NavbarContextType {
  isOpen: boolean;
  toggleNavbar: () => void;
  closeNavbar: () => void;
  isOpen2: boolean;
  toggleNavbar2: () => void;
  closeNavbar2: () => void;
}

const NavbarContext = createContext<NavbarContextType | undefined>(undefined);

export const NavbarProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [isOpen2, setIsOpen2] = useState<boolean>(false);

  const toggleNavbar = () => {
    setIsOpen((prev) => !prev);
  };

  const closeNavbar = () => {
    setIsOpen(false);
  };
  const toggleNavbar2 = () => {
    setIsOpen2((prev) => !prev);
  };

  const closeNavbar2 = () => {
    setIsOpen2(false);
  };

  return (
    <NavbarContext.Provider value={{ isOpen, toggleNavbar, closeNavbar, isOpen2, toggleNavbar2, closeNavbar2 }}>
      {children}
    </NavbarContext.Provider>
  );
};

export const useNavbar = (): NavbarContextType => {
  const context = useContext(NavbarContext);
  if (!context) {
    throw new Error("useNavbar must be used within a NavbarProvider");
  }
  return context;
};
