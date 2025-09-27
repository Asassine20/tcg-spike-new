import { execSync } from "child_process";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

function convertInsertsToCopy(filePath: string): string {
  const sql = readFileSync(filePath, "utf8");
  const lines = sql.split("\n");

  console.log("Total lines in SQL file: ", lines.length);

  let copyStatements = "";
  let currentTable = "";
  let currentColumns: string[] = [];
  let currentValues: string[] = [];
  let insertCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip non-INSERT lines
    if (!trimmed.startsWith("INSERT INTO")) {
      console.log(`Skipping non-INSERT line: ${trimmed.substring(0, 50)}...`);
      continue;
    }

    insertCount++;

    // Parse INSERT statement - handle schema-prefixed table names like public.table_name
    const insertMatch = trimmed.match(
      /INSERT INTO (?:\w+\.)?(\w+) \(([^)]+)\) VALUES (.+);?$/,
    );

    if (!insertMatch) {
      console.warn(`Failed to parse INSERT statement: ${trimmed}...`);
      continue;
    }

    console.log(`Successfully parsed INSERT for table: ${insertMatch[1]}`);

    const table = insertMatch[1];
    const columns = insertMatch[2].split(",").map((col) => col.trim());
    const valuesStr = insertMatch[3];

    // If this is a new table, output previous COPY block
    if (currentTable && currentTable !== table) {
      if (currentValues.length > 0) {
        console.log(
          `Finalizing COPY block for ${currentTable} with ${currentValues.length} rows`,
        );
        copyStatements += `\\COPY ${currentTable} (${currentColumns.join(",")}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N');\n`;
        copyStatements += currentValues.join("\n") + "\n";
        copyStatements += "\\.\n\n";
      }
      currentValues = [];
    }

    currentTable = table;
    currentColumns = columns;

    // Extract values - handle multiple VALUES in one statement
    const valueMatches = valuesStr.match(/\([^)]+\)/g);
    if (valueMatches) {
      console.log(
        `Found ${valueMatches.length} value groups for table ${table}`,
      );
      for (const valueMatch of valueMatches) {
        const values = valueMatch.slice(1, -1); // Remove parentheses
        // Convert SQL values to tab-separated format
        const tabSeparated = values
          .split(",")
          .map((val) => {
            val = val.trim();
            if (val === "NULL") return "\\N";
            if (val.startsWith("'") && val.endsWith("'")) {
              return val.slice(1, -1).replace(/'/g, "''"); // Unescape quotes
            }
            return val;
          })
          .join("\t");
        currentValues.push(tabSeparated);
      }
    } else {
      console.warn(
        `No value matches found for: ${valuesStr.substring(0, 50)}...`,
      );
    }
  }

  // Output final COPY block
  if (currentTable && currentValues.length > 0) {
    console.log(
      `Finalizing final COPY block for ${currentTable} with ${currentValues.length} rows`,
    );
    copyStatements += `\\COPY ${currentTable} (${currentColumns.join(",")}) FROM STDIN WITH (FORMAT csv, DELIMITER E'\\t', NULL '\\N');\n`;
    copyStatements += currentValues.join("\n") + "\n";
    copyStatements += "\\.\n";
  }

  console.log(`Total INSERT statements found: ${insertCount}`);
  console.log(`Final copy statements size: ${copyStatements.length}`);
  if (copyStatements.length > 0) {
    console.log(
      `First 200 chars of copy statements: ${copyStatements.substring(0, 200)}`,
    );
  }

  return copyStatements;
}

async function main() {
  console.log("🌱 Starting database seed...");

  try {
    //   const dataDir = join(__dirname, "data");
    //   const seedFiles = readdirSync(dataDir)
    //     .filter((file) => file.startsWith("seed") && file.endsWith(".sql"))
    //     .sort((a, b) => {
    //       const numA = parseInt(a.match(/seed_(\d+)/)?.[1] || "0");
    //       const numB = parseInt(b.match(/seed_(\d+)/)?.[1] || "0");
    //       return numA - numB;
    //     });

    //   console.log(`Found ${seedFiles.length} seed files:`, seedFiles);

    //   const databaseUrl = process.env.DATABASE_URL;
    //   if (!databaseUrl) {
    //     throw new Error("DATABASE_URL environment variable is required");
    //   }

    //   for (const file of seedFiles) {
    //     const filePath = join(dataDir, file);
    //     console.log(`📦 Processing ${file}...`);

    //     try {
    //       // Convert to COPY format for much faster execution
    //       const copyStatements = convertInsertsToCopy(filePath);
    //       console.log("Copy statements size: ", copyStatements.length);
    //       const tempFile = join(dataDir, `${file}.copy`);
    //       writeFileSync(tempFile, copyStatements);

    //       // Execute the COPY statements
    //       execSync(`psql "${databaseUrl}" -f "${tempFile}"`, {
    //         stdio: "inherit",
    //         encoding: "utf8",
    //       });

    //       // Clean up temp file
    //       execSync(`rm "${tempFile}"`);
    //       console.log(`✅ ${file} completed`);
    //     } catch (error) {
    //       console.error(`❌ Error processing ${file}:`, error);
    //       throw error;
    //     }
    //   }

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
