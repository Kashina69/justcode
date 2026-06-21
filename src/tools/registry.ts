import { Tool } from './types.js';
import { ReadFileTool } from './read_file.js';
import { WriteFileTool } from './write_file.js';
import { EditFileTool } from './edit_file.js';
import { BashTool } from './bash.js';
import { GrepTool } from './grep.js';
import { GlobTool } from './glob.js';
import { ToolDefinition } from '../providers/types.js';

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerTool(new ReadFileTool());
    this.registerTool(new WriteFileTool());
    this.registerTool(new EditFileTool());
    this.registerTool(new BashTool());
    this.registerTool(new GrepTool());
    this.registerTool(new GlobTool());
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
   * 
   * @param name The name of the tool to execute.
   * @param args The input arguments for the tool.
   * @returns A promise resolving to the string output of the tool.
   */
  async executeTool(name: string, args: any): Promise<string> {
    const tool = this.tools.get(name);
    if (!tool) {
      return `Error: Tool "${name}" is not registered.`;
    }
    return tool.execute(args);
  }
}
