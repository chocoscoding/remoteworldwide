import Image from "next/image";
import Link from "next/link";
import { FaXTwitter, FaFacebookF, FaLinkedin, FaLink } from "react-icons/fa6";
import type { CompanyWithJobsCount } from "@/types/main";

/**
 * The company on its own page. On a phone and from lg up it is the card the page always had
 * (CompanySection with showFullDetails, same look, without "Job By"); on a tablet (md to lg) the side-by-side layout
 * squeezed both it and the job list, so there it turns into a banner across the top, logo beside the
 * words, with the list full width under it (owner, 2026-11-05). One element whose layout changes,
 * so the words are in the HTML once. The admin pages keep CompanySection.
 */
export default function CompanyCard({ company, jobCount }: { company: CompanyWithJobsCount; jobCount: number }) {
  const links = [
    { href: company.twitter, Icon: FaXTwitter },
    { href: company.facebook, Icon: FaFacebookF },
    { href: company.linkedin, Icon: FaLinkedin },
    { href: company.website, Icon: FaLink },
  ];

  return (
    <div className="flex h-fit w-full flex-col items-center overflow-hidden rounded-lg border-2 border-black bg-white p-2 drop-shadow-secondary sm:p-3 md:grid md:grid-cols-[auto_minmax(0,1fr)] md:items-center md:gap-x-5 md:gap-y-1.5 md:p-5 lg:flex lg:min-h-[320px] lg:gap-0 lg:p-3">
      <div className="mt-2 flex aspect-square h-fit w-fit flex-shrink-0 items-center justify-center rounded-full border-2 p-1 md:row-span-4 md:mt-0 md:self-start lg:mt-4 lg:self-auto">
        <Image src={company.logo} alt="logo" width={70} height={70} className="w-[50px] rounded-full md:w-[64px] lg:w-[70px]" />
      </div>

      {/* Just the name: "Job By" over it read oddly on the company's own page (owner, 2026-11-05). */}
      <h2 className="mt-2 text-xl font-bold text-primary md:col-start-2 md:mt-0 lg:mt-4">{company.name}</h2>

      <hr className="my-2 w-full bg-gray-900 md:hidden lg:block" />

      <div className="mb-1 flex w-full flex-wrap justify-center gap-4 md:col-start-2 md:mb-0 md:justify-start lg:mb-1 lg:justify-center">
        {links.map(({ href, Icon }, index) =>
          href ? (
            <Link key={index} href={href} target="_blank" rel="noopener noreferrer">
              <Icon className="w-4 text-gray-400" />
            </Link>
          ) : null,
        )}
      </div>

      <p className="whitespace-pre-line break-words text-center text-base text-gray-700 md:col-start-2 md:text-left md:text-sm lg:text-center">
        {company.hiringProfile?.hiringAbout ?? company.about}
      </p>

      <div className="mb-1 mt-2 flex h-6 w-fit items-center justify-center rounded-full bg-secondary p-2.5 md:col-start-2 md:mb-0 md:mt-1 lg:mb-1 lg:mt-2">
        <p className="bg-secondary text-base text-gray-700/70 md:text-sm">{`${jobCount} jobs available`}</p>
      </div>
    </div>
  );
}
