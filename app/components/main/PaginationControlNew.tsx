"use client";
import React, { FC } from "react";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type PaginationControlNewProps = {
  handlePrevious: () => void;
  handleNext: () => void;
  onPageChange: (page: number) => void;
  currentPage: number;
  totalPages: number;
  dataTotal: number;
  startIndex: number;
  endIndex: number;
  scrollToTop?: boolean;
};

const PaginationControlNew: FC<PaginationControlNewProps> = ({
  handlePrevious,
  handleNext,
  onPageChange,
  currentPage,
  totalPages,
  dataTotal,
  startIndex,
  endIndex,
  scrollToTop = false,
}) => {
  const scrollTT = () => {
    if (scrollToTop && typeof window !== "undefined") {
      setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 1);
    }
  };

  const handlePage = (page: number) => {
    scrollTT();
    onPageChange(page);
  };

  // Build the list of page numbers/ellipsis tokens to render
  const getPageItems = (): (number | "ellipsis-start" | "ellipsis-end")[] => {
    if (totalPages <= 1) return totalPages === 1 ? [1] : [];

    const pages = new Set<number>();
    pages.add(1);
    pages.add(totalPages);
    for (let i = currentPage - 1; i <= currentPage + 1; i++) {
      if (i >= 1 && i <= totalPages) pages.add(i);
    }

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const result: (number | "ellipsis-start" | "ellipsis-end")[] = [];

    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
        result.push(i === 1 ? "ellipsis-start" : "ellipsis-end");
      }
      result.push(sorted[i]);
    }

    return result;
  };

  const pageItems = getPageItems();

  return (
    <>
      {/* <hr /> */}
      <div className=" flex justify-between items-center sm:flex-row gap-2 sm:gap-0 flex-col mb-2">
        {/* <p className="flex-shrink-0">
          Showing {startIndex + 1} to {endIndex > dataTotal ? dataTotal : endIndex} of {dataTotal}
        </p> */}

        <Pagination className="mx-0 w-full">
          <PaginationContent>
            {/* Previous */}
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage > 1) {
                    scrollTT();
                    handlePrevious();
                  }
                }}
                aria-disabled={currentPage === 1}
                className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>

            {/* Page numbers */}
            {pageItems.map((item, idx) =>
              item === "ellipsis-start" || item === "ellipsis-end" ? (
                <PaginationItem key={`${item}-${idx}`}>
                  <PaginationEllipsis />
                </PaginationItem>
              ) : (
                <PaginationItem key={item}>
                  <PaginationLink
                    href="#"
                    isActive={item === currentPage}
                    onClick={(e) => {
                      e.preventDefault();
                      if (item !== currentPage) handlePage(item);
                    }}>
                    {item}
                  </PaginationLink>
                </PaginationItem>
              ),
            )}

            {/* Next */}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  if (currentPage < totalPages) {
                    scrollTT();
                    handleNext();
                  }
                }}
                aria-disabled={currentPage === totalPages || totalPages === 0}
                className={currentPage === totalPages || totalPages === 0 ? "pointer-events-none opacity-50" : ""}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </>
  );
};

export default PaginationControlNew;
