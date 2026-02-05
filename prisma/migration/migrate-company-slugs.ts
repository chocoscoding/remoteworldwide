import slugify from "slugify";
import { prisma } from "@/prisma";

async function generateUniqueSlug(name: string, existingSlugs: Set<string>): Promise<string> {
  const slug = slugify(name, {
    lower: true,
    strict: true,
    trim: true,
  });

  // Check if slug is unique
  if (!existingSlugs.has(slug)) {
    existingSlugs.add(slug);
    return slug;
  }

  // If slug exists, append a number
  let counter = 1;
  let uniqueSlug = `${slug}-${counter}`;

  while (existingSlugs.has(uniqueSlug)) {
    counter++;
    uniqueSlug = `${slug}-${counter}`;
  }

  existingSlugs.add(uniqueSlug);
  return uniqueSlug;
}

async function migrateCompanySlugs() {
  try {
    console.log("Starting company slug migration...");

    const companies = await prisma.company.findMany({
      select: {
        id: true,
        name: true,
      },
    });

    console.log(`Found ${companies.length} companies to process`);

    const existingSlugs = new Set<string>();

    // Update each company with a unique slug
    for (const company of companies) {
      const slug = await generateUniqueSlug(company.name, existingSlugs);

      await prisma.company.update({
        where: { id: company.id },
        data: { slug },
      });

      console.log(`${company.name} -> "${slug}"`);
    }

    console.log("\n✅ Migration completed successfully!");
    console.log(`Total companies updated: ${companies.length}`);
  } catch (error) {
    console.error("❌ Error during migration:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

migrateCompanySlugs().catch((error) => {
  console.error(error);
  process.exit(1);
});
