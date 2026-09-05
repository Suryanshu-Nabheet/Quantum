import type { Command } from '../../types/command.js'
import type { ToolUseContext } from '../../Tool.js'

/**
 * /plan — toggle plan mode.
 *
 * In plan mode the model is constrained to planning-only tools
 * (EnterPlanModeTool / ExitPlanModeTool) before it can edit any code.
 * Typing `/plan` injects a prompt that instructs the model to switch into
 * structured planning; `/plan off` exits plan mode.
 */
const plan = {
  type: 'prompt',
  name: 'plan',
  description: 'Toggle plan mode (structured planning before coding)',
  aliases: ['planmode'],
  isEnabled: () => true,
  isHidden: false,
  argumentHint: '[on|off]',
  progressMessage: 'toggling plan mode',
  contentLength: 0,
  source: 'builtin' as const,
  userFacingName() {
    return 'plan'
  },
  // Both parameters are required by PromptCommand — _context is unused here.
  async getPromptForCommand(args: string, _context: ToolUseContext) {
    const arg = (args ?? '').trim().toLowerCase()
    const text =
      arg === 'off'
        ? 'Exit plan mode and return to normal operation.'
        : 'Enter plan mode. Create a detailed plan before making any code changes. Do not write or modify any code until the plan is explicitly approved.'
    return [{ type: 'text' as const, text }]
  },
} satisfies Command

export default plan
