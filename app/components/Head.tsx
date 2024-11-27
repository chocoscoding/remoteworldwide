import Head from "next/head";

export function MetaHeadForJob(props: { company: string; title: string; jobType: string }) {
  const { company, jobType, title } = props;
  const imageUrl = `${process.env.NEXT_PUBLIC_SITE_URL}/api/og/job?title=${encodeURIComponent(title)}&type=${encodeURIComponent(
    jobType
  )}&company=${encodeURIComponent(company)}`;

  return (
    <Head>
      <title>{title}</title>
      <meta content={title} name="description" />
      <meta property="og:image" content={imageUrl} />
    </Head>
  );
}
