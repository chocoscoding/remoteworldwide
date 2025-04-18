"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FC } from "react";

type PaginationControlsType = {
  handlePrevious: () => void; // Function to handle the previous page action
  handleNext: () => void; // Function to handle the next page action
  currentPage: number; // Current active page number
  totalPages: number; // Total number of pages available
  dataTotal: number; // Total number of data entries
  startIndex: number; // Index of the first visible item in the current page
  endIndex: number; // Index of the last visible item in the current page
  scrollToTop?: boolean; //if page should scroll to top if the next or previous button is clicked
};

const PaginationControl: FC<PaginationControlsType> = (props) => {
  const { handleNext, handlePrevious, currentPage, totalPages, dataTotal, startIndex, endIndex, scrollToTop = false } = props;

  const scrollTT = () => {
    if (scrollToTop && typeof window !== "undefined") {
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }, 1);
    }
  };
  return (
    <>
      {/* Divider for better UI separation */}
      <br />
      <hr />

      {/* Pagination Container */}
      <div className="mt-5 flex justify-between items-center sm:flex-row gap-2 sm:gap-0 flex-col">
        <p className="flex-shrink-0">
          Showing {startIndex + 1} to {endIndex > dataTotal ? dataTotal : endIndex} of {dataTotal}
        </p>

        <div className="flex gap-4 items-center px-4 py-2 border rounded-full">
          {/* Previous Button */}
          <button
            onClick={() => {
              scrollTT();
              handlePrevious();
            }}
            disabled={currentPage === 1}
            className={`${currentPage === 1 ? "text-gray-400" : "text-primary"} flex`}>
            <ChevronLeft />
            Previous
          </button>

          {/* Vertical Divider */}
          <div className="h-[30px] border-none bg-gray-500 w-[0.5px]"></div>

          {/* Next Button */}
          <button
            onClick={() => {
              scrollTT();
              handleNext();
            }}
            disabled={currentPage === totalPages || totalPages === 0}
            className={`${currentPage === totalPages || totalPages === 0 ? "text-gray-400" : "text-primary"} flex`}>
            Next
            <ChevronRight />
          </button>
        </div>
      </div>
    </>
  );
};

export default PaginationControl;
