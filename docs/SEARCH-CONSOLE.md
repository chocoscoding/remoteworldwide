# Google Search Console: setup and what to watch

A short guide for www.remoteworldwide.net. The code side is done already: the sitemap, robots.txt and canonical tags are covered in "What the site already does" at the end.

## 1. Verify the property (once)

1. Open https://search.google.com/search-console and click **Add property**.
2. Choose **Domain** and type `remoteworldwide.net` (no `www`, no `https`).
   A Domain property covers www, the bare domain, http and https together.
3. Google shows a TXT record. Add it at your domain's DNS provider, as a TXT record on the root (`@`) with the value Google gives.
4. Wait a few minutes, then click **Verify**. DNS changes can take up to a day; click **Verify** again later if the first try fails.
5. Optional: under **Settings > Users and permissions**, add anyone else who should see the data.

If you already have a URL-prefix property for `https://www.remoteworldwide.net/`, keep it. A Domain property is still worth adding, because it shows every host in one place.

## 2. Submit the sitemap

1. In the left menu, open **Indexing > Sitemaps**.
2. Under **Add a new sitemap**, type `sitemap.xml` and click **Submit**.
   The full address is https://www.remoteworldwide.net/sitemap.xml.
3. After a few hours the status should say **Success**, with a number of discovered URLs (about 1,370 on 2026-10-28).
   - The number goes up and down every day. Jobs leave the sitemap 45 days after they are posted.
   - Blog categories with no posts and landing pages with fewer than 3 open jobs are left out on purpose.

You only submit once. Google re-reads the sitemap by itself.

## 3. Inspect and request indexing for the new pages

These landing pages are live and in the sitemap:

| Page | Address |
|------|---------|
| Latest Jobs | https://www.remoteworldwide.net/jobs/latest |
| Entry level roles | https://www.remoteworldwide.net/jobs/entry-level |
| Frontend developer jobs | https://www.remoteworldwide.net/jobs/frontend-developer |
| Latin America jobs | https://www.remoteworldwide.net/jobs/latin-america |
| Top Companies | https://www.remoteworldwide.net/companies/top |

For each one, after the release is deployed:

1. Paste the address into the search bar at the top of Search Console and press Enter.
2. Click **Test live URL** (top right). Check three things:
   - **Page availability:** "Page can be indexed".
   - **User-declared canonical:** the same address, with no `?page=`.
   - **View tested page > Screenshot:** the job list is visible.
3. Click **Request indexing**. Google allows about 10 requests a day, so do the five landing pages and the newest blog posts first.
4. Come back in a few days and inspect the address again. **URL is on Google** means it is indexed.

Do the same for the blog posts, newest first:

- https://www.remoteworldwide.net/blogs/tailor-resume-to-job-description
- https://www.remoteworldwide.net/blogs/track-job-applications

The other landing pages (Degree Required, No degree required, Jobs not on LinkedIn and the two visa sponsor lists) answer 404 for now, because the job data has no field for them yet. Don't submit them. They go live once that data exists.

## 4. What to watch

Check once a week for the first two months, then once a month.

### Pages report (Indexing > Pages; this used to be called Coverage)

- **Indexed** should grow as jobs, landing pages and posts are crawled.
- These reasons are expected and fine:
  - **Excluded by 'noindex' tag:** expired jobs, page 2 and later of the blog, empty blog categories, and a landing page that has dropped below 3 open jobs.
  - **Alternate page with proper canonical tag.**
  - **Not found (404):** deleted jobs.
  - **Blocked by robots.txt:** dashboard, admin, API, login and sign-up pages.
- These reasons need a look. Click the reason to see the example URLs:
  - **Server error (5xx):** pages failed when Google came. Usually the backend was down or rate-limited Googlebot. Check the backend logs for that day.
  - **Crawled - currently not indexed:** Google read the page and chose not to index it, usually because it is thin or too much like another page. Common for short blog posts.
  - **Discovered - currently not indexed:** Google knows the URL but has not crawled it yet. This is normal for new pages. If it lasts for weeks, add more links to the page from other pages.
  - **Duplicate, Google chose different canonical than user:** two pages look the same. Open both and tell us which ones.
- Use the **Validate fix** button after a fix ships, so Google re-checks those URLs.

### Performance report (Performance > Search results)

- Turn on all four totals: **Clicks, Impressions, CTR, Position**. Use **Last 3 months**.
- Open the **Pages** tab and filter **Page contains** `/jobs/latest`, `/jobs/latin-america`, `/companies/top` or `/blogs/`. You can see:
  - impressions: whether Google shows the page at all;
  - position: how high it ranks;
  - CTR: whether the title and description win the click.
- Open the **Queries** tab to see which searches find you. If a query keeps showing up with no page made for it (for example "remote jobs no degree"), that is a candidate for the next landing page.
- If a page has many impressions but CTR under 1%, its title or description needs work.
- Turn on **Search appearance** to check that **Job listing** results still show for job pages.

### Enhancements (left menu)

- **Job postings:** errors here stop jobs showing in Google for Jobs. Fix any that appear.
- **Breadcrumbs:** should report valid items for jobs, landing pages and blog posts.

## What the site already does

- **Sitemap:** `/sitemap.xml` lists the home page, tool pages, open jobs (45 days), companies, blog posts, blog categories that have posts, authors, and the landing pages that have at least 3 open listings.
- **robots.txt:**
  - It blocks only private and duplicate areas: the dashboard, admin, API, sign-in pages and tracking links.
  - It now allows `/api/og/`, so link previews and Google can load share images.
  - It points to the sitemap.
- **Canonical tags:** every landing page and every `?page=N` of it is its own canonical, as on `/jobs?page=N`. Blog posts, jobs and companies each point at their own address.
- **Thin pages stay out:**
  - A landing page with fewer than 3 open jobs gets `noindex, follow` and drops out of the sitemap on its own.
  - It comes back once it has 3 or more.
  - Empty blog categories get the same treatment.
- **Structured data:**
  - Landing pages carry a CollectionPage with an ItemList of their listings, plus a BreadcrumbList.
  - Jobs carry JobPosting.
  - Blog posts carry BlogPosting and BreadcrumbList.
