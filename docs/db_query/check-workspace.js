const fs = require("fs");
const path = require("path");

function loadEnvFile(fileName) {
  const filePath = path.join(__dirname, fileName);
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

loadEnvFile(".env.local");
loadEnvFile(".env");

// Mock React cache before requiring the workspace service
const react = require("react");
react.cache = (fn) => fn;

// Mock server-only before requiring the workspace service
try {
  const serverOnlyPath = require.resolve("server-only");
  require.cache[serverOnlyPath] = {
    id: "server-only",
    exports: {},
    loaded: true,
  };
} catch {
  const Module = require("module");
  const originalResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, parent, isMain, options) {
    if (request === "server-only") {
      return "server-only";
    }
    return originalResolve.apply(this, arguments);
  };
  require.cache["server-only"] = {
    id: "server-only",
    exports: {},
    loaded: true,
  };
}

const { createClient } = require("@supabase/supabase-js");
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const { listWorkspaceExpenses } = require("../lib/workspace-service");

async function main() {
  const userId = "f2bd2bcb-3072-44a2-81e1-4209034e6849";
  const context = {
    supabase,
    tenant: {
      id: "250fcb53-a524-415a-a838-80fca66b909b",
      name: "Agency Test",
      slug: "agency-test",
      timezone: "Europe/London",
    },
    tenantMembership: {
      role: "owner",
    },
    user: {
      id: userId,
    },
    permissions: ["expenses.view"],
  };

  const data = await listWorkspaceExpenses(context);
  const targetExpense = data.expenses.find((e) => e.id === "41c34dc0-7603-442f-8181-00d910b8d8ea");
  console.log("Expense details:", targetExpense);
  console.log("Activities for this expense:", targetExpense.activities);
}
main().catch(console.error);
