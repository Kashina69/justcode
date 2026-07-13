const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, "utf-8");
  content.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const index = trimmed.indexOf("=");
    if (index === -1) return;
    const key = trimmed.substring(0, index).trim();
    let val = trimmed.substring(index + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) {
      val = val.substring(1, val.length - 1);
    } else if (val.startsWith("'") && val.endsWith("'")) {
      val = val.substring(1, val.length - 1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  });
}

loadEnvFile(".env");

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data: cols, error } = await supabase.rpc("get_table_columns", { table_name: "projects" });
  console.log("Projects Columns (rpc):", cols, error);

  // If RPC is not available, try standard query to information_schema if allowed, or query a single row
  const { data: row } = await supabase.from("projects").select("*").limit(1);
  console.log("Projects row keys:", row ? Object.keys(row[0] || {}) : null);

  const { data: settingsRow } = await supabase.from("tenant_settings").select("*").limit(1);
  console.log("tenant_settings row keys:", settingsRow ? Object.keys(settingsRow[0] || {}) : null);
}
main().catch(console.error);
