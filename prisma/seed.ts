import { readdirSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function executeSqlFile(filePath: string, fileName: string) {
  console.log(`📦 Processing ${fileName}...`);

  const sql = readFileSync(filePath, "utf8");

  // More comprehensive filtering for PostgreSQL dump files
  const lines = sql.split("\n");
  const validLines = lines.filter((line) => {
    const trimmed = line.trim();

    // Skip empty lines
    if (!trimmed) return false;

    // Skip comments
    if (trimmed.startsWith("--")) return false;
    if (trimmed.startsWith("/*")) return false;

    // Skip PostgreSQL dump metadata
    if (trimmed.startsWith("SET ")) return false;
    if (trimmed.startsWith("SELECT pg_catalog")) return false;
    if (trimmed.startsWith("COPY ")) return false;
    if (trimmed.startsWith("\\")) return false;
    if (trimmed.match(/^(SHOW|CREATE SCHEMA|DROP SCHEMA|ALTER TABLE.*OWNER)/i))
      return false;

    // Skip dump metadata lines
    if (trimmed.includes("Type: TABLE DATA")) return false;
    if (trimmed.includes("Schema: ")) return false;
    if (trimmed.includes("Owner: ")) return false;
    if (trimmed.includes("Tablespace: ")) return false;

    return true;
  });

  // Join valid lines and split by semicolon
  const cleanSql = validLines.join("\n");
  const statements = cleanSql
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => {
      // Only keep INSERT statements and CREATE statements if needed
      return (
        stmt.length > 0 &&
        (stmt.toUpperCase().startsWith("INSERT INTO") ||
          stmt.toUpperCase().startsWith("CREATE TABLE") ||
          stmt.toUpperCase().startsWith("ALTER TABLE"))
      );
    });

  console.log(`   Found ${statements.length} valid SQL statements to execute`);

  if (statements.length === 0) {
    console.log(`   ⚠️  No valid statements found in ${fileName}`);
    return;
  }

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];

    try {
      await prisma.$executeRawUnsafe(statement + ";");

      // Log progress for large files
      if (
        statements.length > 10 &&
        (i + 1) % Math.max(1, Math.floor(statements.length / 10)) === 0
      ) {
        console.log(
          `   Progress: ${i + 1}/${statements.length} statements executed`,
        );
      }
    } catch (error) {
      console.error(`❌ Error executing statement ${i + 1}:`);
      console.error(`   Statement: ${statement.substring(0, 200)}...`);
      console.error(
        `   Error:`,
        error instanceof Error ? error.message : error,
      );
      throw error;
    }
  }

  console.log(
    `✅ ${fileName} completed (${statements.length} statements executed)`,
  );
}

async function main() {
  console.log("🌱 Starting database seed...");

  try {
    const dataDir = join(__dirname, "data");

    // Get all files that start with "seed" and have .sql extension
    const allFiles = readdirSync(dataDir);
    const seedFiles = allFiles
      .filter((file) => file.startsWith("seed") && file.endsWith(".sql"))
      .sort((a, b) => {
        // Extract numbers from filenames for proper sorting
        const numA = parseInt(a.match(/seed_(\d+)/)?.[1] || "0");
        const numB = parseInt(b.match(/seed_(\d+)/)?.[1] || "0");
        return numA - numB;
      });

    console.log(`Found ${seedFiles.length} seed files:`, seedFiles);

    for (const file of seedFiles) {
      const filePath = join(dataDir, file);
      await executeSqlFile(filePath, file);
    }

    console.log("🎉 Database seeding completed!");
  } catch (error) {
    console.error("❌ Error during seeding:", error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
