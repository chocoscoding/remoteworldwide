import { CompanyWithJobsCount } from "@/types/main";
import { LinkIcon, MoveUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";
import { FaXTwitter, FaFacebookF, FaLinkedin } from "react-icons/fa6";
const CompanySection: FC<{
  showFullDetails?: boolean;
  name?: string;
  companyDetails: CompanyWithJobsCount;
  forAdmin?: boolean;
}> = ({ showFullDetails = false, forAdmin = false, companyDetails }) => {
  const socialMediaLinks = [
    { href: companyDetails.twitter ?? "#", Icon: FaXTwitter },
    { href: companyDetails.facebook ?? "#", Icon: FaFacebookF },
    { href: companyDetails.linkedin ?? "#", Icon: FaLinkedin },
    { href: companyDetails.website ?? "#", Icon: LinkIcon },
  ];
  return (
    <div
      className={`border-2 border-black h-fit md:min-h-[300px] rounded-lg flex-1 w-full lg:w-auto drop-shadow-secondary bg-white flex flex-col items-center p-2 sm:p-3 overflow-hidden ${
        showFullDetails ? "lg:min-h-[320px]" : ""
      }`}>
      <div className="border-2 rounded-full p-1 w-fit h-fit mt-2 md:mt-3 lg:mt-4">
        <Image src={companyDetails.logo} alt="logo" width={70} height={70} className="rounded-full lg:w-[70px] w-[50px]" />
      </div>
      <div className="flex flex-col items-center lg:mt-4 mt-2">
        <p className="text-gray-500">Job By</p>
        {showFullDetails ? (
          <div className="flex items-center gap-2">
            <p className="text-primary font-bold text-xl">{companyDetails.name}</p>
          </div>
        ) : (
          <Link href={`${forAdmin ? "/heroshima" : ""}/companies/${companyDetails.name}`} passHref>
            <div className="flex items-center gap-2 cursor-pointer">
              <p className="text-primary font-bold text-xl">{companyDetails.name}</p>
              <MoveUpRight className="w-4" />
            </div>
          </Link>
        )}
      </div>
      <hr className="bg-gray-900 my-2  w-full" />
      {showFullDetails ? (
        <div className="flex flex-wrap justify-center w-full gap-4 mb-1">
          {socialMediaLinks.map(
            ({ href, Icon }, index) =>
              href && (
                <Link key={index} href={href} target="_blank" rel="noopener noreferrer">
                  <Icon className="text-gray-400 w-4" />
                </Link>
              )
          )}
        </div>
      ) : null}
      <p className="text-base md:text-sm text-gray-700">
        {companyDetails.about.length > 200 ? `${companyDetails.about.substring(0, 200)}...` : companyDetails.about}
      </p>

      {showFullDetails ? (
        <div className=" bg-secondary h-6 w-fit p-2.5 rounded-full flex items-center justify-center mt-2 mb-1">
          <p className="text-base md:text-sm text-gray-700/70 bg-secondary">{`${companyDetails._count?.jobs ?? "no"} jobs available`} </p>
        </div>
      ) : null}
    </div>
  );
};

export default CompanySection;
