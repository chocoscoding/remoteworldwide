import Link from "next/link";
import "./Error.css"; // assuming your CSS is saved here

const NotFound = () => {
  return (
    <section className="h-screen bg-green mainbody w-screen">
      <div className="noise"></div>
      <div className="overlay"></div>
      <div className="terminal">
        <h1>
          Error <span className="errorcode">404</span>
        </h1>
        <p className="output">The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.</p>
        <p className="output">
          Please try to go back or <Link href="/">return to the homepage</Link>.
        </p>
        <p className="output">Good luck.</p>
      </div>
    </section>
  );
};

export default NotFound;
