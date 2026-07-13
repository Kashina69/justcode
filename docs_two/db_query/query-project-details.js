const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  const projectId = "5afc7977-dbdb-4f0f-88f6-aad075641cd3"; // Project 1

  console.log("=== PROJECT 1 DETAILS ===");
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();
  console.log(project);

  console.log("=== TIMESHEET ENTRIES ===");
  const { data: timesheets } = await supabase
    .from("timesheet_entries")
    .select("*")
    .eq("project_id", projectId);
  console.log(timesheets);

  console.log("=== EXPENSES ===");
  const { data: expenses } = await supabase
    .from("expenses")
    .select("*")
    .eq("project_id", projectId);
  console.log(expenses);

  console.log("=== HEALTH SNAPSHOTS FOR PROJECT 1 ===");
  const { data: health } = await supabase
    .from("project_health_snapshots")
    .select("*")
    .eq("project_id", projectId);
  console.log(health);
}

main().catch(console.error);
