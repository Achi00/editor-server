#!/bin/bash
set -e # Exit immediately if a command exits with a non-zero status.

echo "Checking for package.json..."
if [ -f "package.json" ]; then
  echo "package.json found. Installing dependencies..."
  if npm install --verbose; then
    echo "Dependencies installed."
  else
    echo "Failed to install dependencies."
    exit 1
  fi
else
  echo "No package.json found. Skipping dependency installation."
fi

# Execute the user script
echo "Executing script: $1"
exec node "$1"
