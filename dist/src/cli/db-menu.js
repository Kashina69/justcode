import { colors } from './colors.js';
import { loadDbConfig, promptDbSetup } from '../db/config.js';
import { runDbSchema, runDbQuery, runDbRevalidate, runDbMemoryList, runDbAsk, } from './db-actions.js';
/**
 * Handles all /db command routing.
 */
export async function handleDbCommand(context, input) {
    const parts = input.split(/\s+/);
    const subCommand = parts[1]?.toLowerCase();
    // If no subcommand or help requested, show DB guide
    if (!subCommand || subCommand === 'help') {
        showDbHelp();
        return 'sync';
    }
    // Setup connection
    if (subCommand === 'setup') {
        await promptDbSetup(context.rl);
        return 'sync';
    }
    // Check config, setup if missing
    let config = await loadDbConfig();
    if (!config) {
        console.log(`${colors.yellow}⚠️ No database configured yet. Running setup wizard...${colors.reset}`);
        config = await promptDbSetup(context.rl);
    }
    switch (subCommand) {
        case 'schema':
            await runDbSchema(context, config);
            break;
        case 'query':
            await runDbQuery(context, config, input);
            break;
        case 'revalidate':
            await runDbRevalidate(context, config);
            break;
        case 'memory':
            await runDbMemoryList();
            break;
        case 'ask':
            await runDbAsk(context, config, input);
            break;
        default:
            console.log(`${colors.red}Unknown subcommand. Type "/db" or "/db help" for options.${colors.reset}`);
    }
    return 'sync';
}
function showDbHelp() {
    console.log(`\n${colors.bold}${colors.cyan}🗄 DB Admin Agent Sub-system:${colors.reset}`);
    console.log('  Administer and design database schemas with the assistance of a senior DB engineer.');
    console.log(`\n  ${colors.bold}Commands:${colors.reset}`);
    console.log(`    • ${colors.bold}/db setup${colors.reset}                  Run the connection wizard`);
    console.log(`    • ${colors.bold}/db schema${colors.reset}                 Introspect schema, export to MD and show ASCII`);
    console.log(`    • ${colors.bold}/db query <SQL/NoSQL>${colors.reset}       Run a query (requires confirmation for mutations)`);
    console.log(`    • ${colors.bold}/db ask <question>${colors.reset}         Ask the DB Admin Agent a design or query question`);
    console.log(`    • ${colors.bold}/db memory${colors.reset}                 List cached schema memory nodes`);
    console.log(`    • ${colors.bold}/db revalidate${colors.reset}             Revalidate schema and record changes to memory`);
    console.log('');
}
