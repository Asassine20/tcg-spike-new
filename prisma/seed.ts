import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import { prisma } from "@/lib/db";

async function main() {
  console.log("🌱 Starting database seed...");

  try {
    const dataDir = join(__dirname, "data");
    const seedFiles = readdirSync(dataDir)
      .filter((file) => file.startsWith("seed") && file.endsWith(".sql"))
      .sort((a, b) => {
        const numA = parseInt(a.match(/seed_(\d+)/)?.[1] || "0");
        const numB = parseInt(b.match(/seed_(\d+)/)?.[1] || "0");
        return numA - numB;
      });

    console.log(`Found ${seedFiles.length} seed files:`, seedFiles);

    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL environment variable is required");
    }

    for (const file of seedFiles) {
      const filePath = join(__dirname, "data", file);
      console.log(`Executing seed file: ${file}`);

      const sql = readFileSync(filePath, "utf-8");

      // Execute the entire file as a single block.
      // This is more robust than splitting by semicolons.
      await prisma.$executeRawUnsafe(sql);
    }

    console.log("Database seeded successfully!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
