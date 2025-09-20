import { readdirSync } from "fs";
import { join } from "path";
import { execSync } from "child_process";

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
      const filePath = join(dataDir, file);
      console.log(`📦 Processing ${file}...`);

      try {
        // Use psql to execute the entire file at once
        execSync(`psql "${databaseUrl}" -f "${filePath}"`, {
          stdio: 'inherit',
          encoding: 'utf8'
        });
        console.log(`✅ ${file} completed`);
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error);
        throw error;
      }
    }

    console.log("🎉 Database seeding completed!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});