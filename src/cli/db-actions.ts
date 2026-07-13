import { CliContext } from './context.js';
import { colors } from './colors.js';
import { loadDbConfig, promptDbSetup } from '../db/config.js';
import { executeQuery } from '../db/executor.js';
import { introspectSchema, renderSchemaAscii, renderSchemaMermaid, saveSchemaToFile } from '../db/schema.js';
import { loadDbMemory, revalidateSchema } from '../db/memory.js';
import { formatQueryResult, formatError } from '../db/formatter.js';
import { AgentOrchestrator } from '../agent/index.js';
import { readPromptSync } from '../config/prompts.js';
import { ConversationMessage } from '../providers/types.js';

let dbHistory: ConversationMessage[] = [];

/**
 * Runs the database schema introspection action.
 */
export async function runDbSchema(context: CliContext, config: any): Promise<void> {
  context.spinner.start('🔍 Introspecting database schema...');
  try {
    const schema = await introspectSchema(config);
    context.spinner.stop();
    const ascii = renderSchemaAscii(schema);
    console.log(`\n${colors.bold}${colors.cyan}--- Database Schema (ASCII) ---${colors.reset}`);
    console.log(ascii);

    const outputPath = '.agent/db/schema.md';
    await saveSchemaToFile(schema, outputPath);
    console.log(`${colors.green}✔ Schema reference saved to: ${colors.bold}${outputPath}${colors.reset}\n`);
  } catch (err: any) {
    context.spinner.stop();
    console.error(formatError(err.message));
  }
}

/**
 * Runs the database query execution action.
 */
export async function runDbQuery(context: CliContext, config: any, input: string): Promise<void> {
  const query = input.substring(input.indexOf('query') + 5).trim();
  if (!query) {
    console.log(`${colors.red}Error: Please specify a query. Usage: /db query <SQL/NoSQL>${colors.reset}`);
    return;
  }

  const onConfirmWrite = async (): Promise<boolean> => {
    if (context.spinner.active()) context.spinner.stop();
    return new Promise((resolve) => {
      context.rl.question(`\n${colors.yellow}⚠️ [DB WARNING] This query performs write/alter operations. Do you want to execute it? (y/N): ${colors.reset}`, (ans) => {
        resolve(ans.trim().toLowerCase() === 'y');
      });
    });
  };

  context.spinner.start('⚙ Executing query...');
  try {
    const result = await executeQuery(config, query, onConfirmWrite);
    context.spinner.stop();
    console.log('\n' + formatQueryResult(result));
  } catch (err: any) {
    context.spinner.stop();
    console.error(formatError(err.message));
  }
}

/**
 * Runs the database schema revalidation action.
 */
export async function runDbRevalidate(context: CliContext, config: any): Promise<void> {
  context.spinner.start('🔄 Revalidating schema and cache...');
  try {
    const res = await revalidateSchema(config);
    context.spinner.stop();
    if (res.changed) {
      console.log(`\n${colors.green}✔ Schema changes detected and recorded in memory!${colors.reset}`);
      console.log(`${colors.dim}${res.diff}${colors.reset}\n`);
    } else {
      console.log(`\n${colors.green}✔ No schema changes detected. Cache is up to date.${colors.reset}\n`);
    }
  } catch (err: any) {
    context.spinner.stop();
    console.error(formatError(err.message));
  }
}

/**
 * Displays DB memory list.
 */
export async function runDbMemoryList(): Promise<void> {
  try {
    const mem = await loadDbMemory();
    console.log(`\n${colors.bold}${colors.cyan}--- DB Agent Memory Nodes ---${colors.reset}`);
    if (mem.length === 0) {
      console.log('  (no memory nodes recorded yet)');
    } else {
      mem.forEach((m) => {
        console.log(`  - [${m.tags.join(', ')}] ${m.summary} (${m.id})`);
      });
    }
    console.log('');
  } catch (err: any) {
    console.error(formatError(err.message));
  }
}

/**
 * Starts a database agent sub-session question.
 */
export async function runDbAsk(context: CliContext, config: any, input: string): Promise<void> {
  const question = input.substring(input.indexOf('ask') + 3).trim();
  if (!question) {
    console.log(`${colors.red}Error: Please specify a question. Usage: /db ask <question>${colors.reset}`);
    return;
  }

  context.spinner.start('🧠 Gathering schema and memory context...');
  try {
    const schema = await introspectSchema(config);
    const schemaMermaid = renderSchemaMermaid(schema);
    const schemaAscii = renderSchemaAscii(schema);
    const dbMemory = await loadDbMemory();
    const dbMemoryText = dbMemory.map((m) => `- [${m.tags.join(', ')}] ${m.summary} (ID: ${m.id})`).join('\n');

    const systemPromptBase = readPromptSync('db_admin_system.txt');
    const systemPrompt = `${systemPromptBase}

## Current Database Schema (Type: ${config.type}, Name: ${config.name})
\`\`\`mermaid
${schemaMermaid}
\`\`\`

## Schema Details
\`\`\`
${schemaAscii}
\`\`\`

## Database Memories
${dbMemoryText || 'No memory nodes recorded yet.'}
`;

    const orchestratorOptions = {
      config: (context.orchestrator as any).config,
      registry: (context.orchestrator as any).registry,
      safetyGate: (context.orchestrator as any).safetyGate,
      backupManager: (context.orchestrator as any).backupManager,
      onConfirmDangerousTool: (context.orchestrator as any).onConfirmDangerousTool,
      systemPrompt,
    };

    const dbOrchestrator = new AgentOrchestrator(orchestratorOptions);
    context.spinner.stop();

    dbHistory.push({ role: 'user', content: question });

    dbHistory = await dbOrchestrator.runTurn(dbHistory, (progress) => {
      if (progress.type === 'request_start') {
        context.spinner.start('🤖 DB Agent is thinking...');
      } else if (progress.type === 'request_end') {
        context.spinner.stop();
      } else if (progress.type === 'thinking' && progress.content) {
        if (context.spinner.active()) context.spinner.stop();
        console.log(`\n🧠 ${colors.bold}${colors.magenta}Thinking:${colors.reset}`);
        console.log(`${colors.gray}${colors.dim}┌──────────────────────────────────────────────────`);
        const thinkLines = progress.content.trim().split('\n');
        for (const line of thinkLines) {
          console.log(`${colors.gray}${colors.dim}│${colors.reset} ${colors.gray}${colors.italic}${line}${colors.reset}`);
        }
        console.log(`${colors.gray}${colors.dim}└──────────────────────────────────────────────────${colors.reset}\n`);
      } else if (progress.type === 'tool_start' && progress.toolCall) {
        if (context.spinner.active()) context.spinner.stop();
        console.log(`${colors.dim}⚙️  [Tool] ${colors.bold}${progress.toolCall.name}${colors.reset}`, progress.toolCall.input);
        context.spinner.start(`⚙️  Running: ${progress.toolCall.name}...`);
      } else if (progress.type === 'tool_end' && progress.toolCall) {
        if (context.spinner.active()) context.spinner.stop();
        const resSnippet = progress.result && progress.result.length > 200 ? progress.result.substring(0, 200) + '...' : progress.result;
        console.log(`${colors.dim}✔️  [${progress.toolCall.name}] →\n${resSnippet}${colors.reset}`);
      }
    });

    const lastMsg = dbHistory[dbHistory.length - 1];
    if (lastMsg && lastMsg.role === 'assistant') {
      if (typeof lastMsg.content === 'string') {
        console.log(`\n${lastMsg.content}\n`);
      } else if (Array.isArray(lastMsg.content)) {
        const text = lastMsg.content.map((b) => (b.type === 'text' ? b.text : '')).join('\n');
        console.log(`\n${text}\n`);
      }
    }
  } catch (err: any) {
    context.spinner.stop();
    console.error(formatError(err.message));
  }
}
