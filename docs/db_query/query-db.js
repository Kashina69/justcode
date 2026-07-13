const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log("=== PROJECTS ===");
  const { data: projects, error: err1 } = await supabase.from("projects").select("*");
  console.log(projects || err1);

  console.log("=== HEALTH SNAPSHOTS ===");
  const { data: health, error: err2 } = await supabase.from("project_health_snapshots").select("*");
  console.log(health || err2);

  console.log("=== CLIENTS ===");
  const { data: clients, error: err3 } = await supabase.from("clients").select("*");
  console.log(clients || err3);

  console.log("=== AI INSIGHTS ===");
  const { data: insights, error: err4 } = await supabase.from("ai_insights").select("*");
  console.log(insights || err4);
}

main().catch(console.error);
