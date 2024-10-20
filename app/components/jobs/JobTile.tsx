import Image from "next/image";
import React from "react";

const JobTile = () => {
  return (
    <div className="flex">
      {/* logo
    main info */}
      <div className="flex">
        <div>
          <Image src="/images/Vector.png" alt="logo" width={50} height={50} />
        </div>
      </div>

      {/* date */}
    </div>
  );
};

export default JobTile;
