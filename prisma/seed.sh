#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Get the directory of the script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Path to the data directory
DATA_DIR="$DIR/data"

# Check if psql is installed
if ! [ -x "$(command -v psql)" ]; then
  echo 'Error: psql is not installed. Please install PostgreSQL client tools.' >&2
  exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set. Make sure it's in your .env file and the script is run with dotenv." >&2
  exit 1
fi

echo "Seeding database from $DATA_DIR..."

# Loop through SQL files in order and execute them
for sql_file in "$DATA_DIR"/seed_*.sql; do
  if [ -f "$sql_file" ]; then
    echo "Executing seed file: $(basename "$sql_file")"
    # Use psql to execute the SQL file. The -v ON_ERROR_STOP=1 flag ensures the script stops on any error.
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$sql_file"
  fi
done

echo "Database seeded successfully!"
