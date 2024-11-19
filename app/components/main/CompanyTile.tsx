import { Company } from "@prisma/client";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import React, { FC } from "react";

const CompanyTile: FC<{ forCompany?: boolean; companyData: Company }> = ({ forCompany = false, companyData }) => {
  return (
    //:TODO
    <Link href={forCompany ? `/heroshima/companies/${companyData.name}` : `/companies/${companyData.name}`}>
      <div className="flex flex-col gap-3 bg-white p-2 rounded-lg group transition-all">
        <div className="flex w-full items-center">
          <div className="border-2 rounded-full p-1 w-fit h-fit flex-shrink-0">
            <Image src={companyData.logo} alt="logo" width={40} height={40} className="rounded-full flex-shrink-0" />
          </div>
          <p className="text-lg font-semibold text-primary ml-2">{companyData.name}</p>
        </div>
        <p className="text-gray-500 text-sm">
          {companyData.about.length > 200 ? `${companyData.about.substring(0, 200)}...` : companyData.about}
        </p>
        <div className="flex justify-between items-center">
          <div className="bg-gray-100 p-2 rounded-md flex-shrink-0">12 jobs Available</div>
          <ArrowUpRight className="flex-shrink-0 text-gray-500 group-hover:text-secondary" />
        </div>
      </div>
    </Link>
  );
};

export default CompanyTile;
