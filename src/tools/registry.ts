import readline from 'readline';
import { Tool } from './types.js';
import { ReadFileTool } from './read_file.js';
import { WriteFileTool } from './write_file.js';
import { EditFileTool } from './edit_file.js';
import { BashTool, StartProcessTool, CheckProcessTool, WaitProcessTool } from './bash/index.js';
import { GrepTool } from './grep.js';
import { GlobTool } from './glob.js';
import { ToolDefinition } from '../providers/types.js';
import { KNOWN_TOOLS } from '../safety/gate.js';
import {
  SearchMemoryTool,
  RecallMemoryTool,
  RecordMemoryTool,
  GetMemoryNodeTool
} from './memory_tools.js';
import { AskUserTool } from './ask_user.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerTool(new ReadFileTool());
    this.registerTool(new WriteFileTool());
    this.registerTool(new EditFileTool());
    this.registerTool(new BashTool());
    this.registerTool(new StartProcessTool());
    this.registerTool(new CheckProcessTool());
    this.registerTool(new WaitProcessTool());
    this.registerTool(new GrepTool());
    this.registerTool(new GlobTool());
    this.registerTool(new SearchMemoryTool());
    this.registerTool(new RecallMemoryTool());
    this.registerTool(new RecordMemoryTool());
    this.registerTool(new GetMemoryNodeTool());
    this.registerTool(new AskUserTool());

    // Sanity-check: every registered tool must appear in the shared KNOWN_TOOLS set.
    // This ensures the safety gate and dispatcher are always in sync.
    for (const [name] of this.tools) {
      if (!KNOWN_TOOLS.has(name)) {
        throw new Error(
          `[ToolRegistry] Tool "${name}" is registered in the dispatcher but missing from KNOWN_TOOLS in gate.ts. ` +
          `Add it to KNOWN_TOOLS to keep the safety gate in sync.`
        );
      }
    }
  }

  /**
   * Sets the active readline interface on any tools that require it.
   */
  setReadline(rl: readline.Interface): void {
    const askUser = this.tools.get('ask_user') as AskUserTool;
    if (askUser) {
      askUser.setReadline(rl);
    }
  }

  /**
   * Registers a new tool in the registry.
   *
   * @param tool The tool instance to register.
   */
  registerTool(tool: Tool): void {
    this.tools.set(tool.definition.name, tool);
  }

  /**
   * Lists the definitions of all registered tools.
   *
   * @returns Array of registered ToolDefinition objects.
   */
  getToolDefinitions(): ToolDefinition[] {
    return Array.from(this.tools.values()).map((tool) => tool.definition);
  }

  /**
   * Finds a tool by name and executes it with the provided arguments.
   * Returns a clear error if the tool is not in the registry — it will NOT silently execute.
   *
   * @param name The name of the tool to execute.
   * @param args The input arguments for the tool.
   * @returns A promise resolving to the string output of the tool.
   */
  async executeTool(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      // This path should only be reached if classifyToolCall somehow let an unknown tool through.
      // The safety gate's KNOWN_TOOLS check should catch this first.
      return `Error: Tool "${name}" is not registered. Execution blocked.`;
    }
    return tool.execute(args);
  }
}
