// prisma/migration/detect-duplicates.ts
import { prisma } from "@/prisma";

async function detectDuplicates() {
  try {
    console.log("Checking for duplicate company names and null slugs...\n");

    // Find all companies
    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    console.log(`Total companies: ${companies.length}\n`);

    // Check for null slugs
    const nullSlugs = companies.filter((c) => c.slug === null || c.slug === "");
    console.log(`Companies with null/empty slugs: ${nullSlugs.length}`);
    if (nullSlugs.length > 0) {
      console.log("Companies with null slugs:");
      nullSlugs.forEach((c) => console.log(`  - ID: ${c.id}, Name: ${c.name}`));
      console.log();
    }

    // Check for duplicate names
    const nameCount = new Map<string, number>();
    companies.forEach((c) => {
      nameCount.set(c.name, (nameCount.get(c.name) || 0) + 1);
    });

    const duplicateNames = Array.from(nameCount.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (duplicateNames.length > 0) {
      console.log(`Duplicate company names found: ${duplicateNames.length}`);
      duplicateNames.forEach(([name, count]) => {
        console.log(`  - "${name}" appears ${count} times`);
        const dupes = companies.filter((c) => c.name === name);
        dupes.forEach((d) => console.log(`    ID: ${d.id}, Slug: ${d.slug || "(null)"}`));
      });
      console.log();
    }

    // Check for duplicate slugs (excluding nulls)
    const slugCount = new Map<string, number>();
    companies
      .filter((c) => c.slug !== null && c.slug !== "")
      .forEach((c) => {
        slugCount.set(c.slug!, (slugCount.get(c.slug!) || 0) + 1);
      });

    const duplicateSlugs = Array.from(slugCount.entries())
      .filter(([_, count]) => count > 1)
      .sort((a, b) => b[1] - a[1]);

    if (duplicateSlugs.length > 0) {
      console.log(`Duplicate slugs found: ${duplicateSlugs.length}`);
      duplicateSlugs.forEach(([slug, count]) => {
        console.log(`  - "${slug}" appears ${count} times`);
        const dupes = companies.filter((c) => c.slug === slug);
        dupes.forEach((d) => console.log(`    ID: ${d.id}, Name: ${d.name}`));
      });
      console.log();
    }

    // Summary
    console.log("\n=== SUMMARY ===");
    console.log(`Total companies: ${companies.length}`);
    console.log(`Null/empty slugs: ${nullSlugs.length}`);
    console.log(`Duplicate names: ${duplicateNames.length}`);
    console.log(`Duplicate slugs: ${duplicateSlugs.length}`);

    if (nullSlugs.length === 0 && duplicateNames.length === 0 && duplicateSlugs.length === 0) {
      console.log("\n✅ No issues found!");
    } else {
      console.log("\n⚠️  Issues detected. Run the slug migration script to fix.");
    }
  } catch (error) {
    console.error("❌ Error:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

detectDuplicates().catch((error) => {
  console.error(error);
  process.exit(1);
});
