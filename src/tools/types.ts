import { ToolDefinition } from '../providers/types.js';

export interface Tool {
  definition: ToolDefinition;

  /**
   * Executes the tool logic with the parsed arguments.
   * 
   * @param args The input arguments mapping to definition.inputSchema.
   * @returns A promise resolving to the string representation of the tool output.
   */
  execute(args: any): Promise<string>;
}
