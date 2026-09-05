import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test'

const actualSettings = await import('../utils/settings/settings.js')

beforeAll(() => {
  mock.module('../utils/settings/settings.js', () => ({
    ...actualSettings,
    getSettings_DEPRECATED: () => ({}),
  }))
})

afterAll(() => {
  mock.restore()
})

import stripAnsi from 'strip-ansi'
import { detectProvider, paintLine, printStartupScreen } from './StartupScreen.js'
import { LOGO_PALETTES } from './StartupScreen.palettes.js'
import { saveGlobalConfig } from '../utils/config.js'
import {
  resetSettingsCache,
  setSessionSettingsCache,
} from '../utils/settings/settingsCache.js'

const ENV_KEYS = [
  'CI',
  'CLAUDE_CODE_USE_OPENAI',
  'CLAUDE_CODE_USE_GEMINI',
  'CLAUDE_CODE_USE_GITHUB',
  'CLAUDE_CODE_USE_BEDROCK',
  'CLAUDE_CODE_USE_VERTEX',
  'CLAUDE_CODE_USE_MISTRAL',
  'OPENAI_BASE_URL',
  'OPENAI_API_KEY',
  'OPENAI_MODEL',
  'GEMINI_MODEL',
  'GEMINI_BASE_URL',
  'MISTRAL_MODEL',
  'MISTRAL_BASE_URL',
  'ANTHROPIC_MODEL',
  'CLAUDE_MODEL',
  'NVIDIA_NIM',
  'MINIMAX_API_KEY',
  'XAI_API_KEY',
  'ANTHROPIC_DEFAULT_OPUS_MODEL',
  'ANTHROPIC_DEFAULT_SONNET_MODEL',
  'ANTHROPIC_DEFAULT_HAIKU_MODEL',
  'ANTHROPIC_BASE_URL',
]

const originalEnv: Record<string, string | undefined> = {}
const originalMacro = (globalThis as Record<string, unknown>).MACRO
const originalIsTTY = process.stdout.isTTY
const originalWrite = process.stdout.write

beforeEach(() => {
  for (const key of ENV_KEYS) {
    originalEnv[key] = process.env[key]
    delete process.env[key]
  }
  setSessionSettingsCache({ settings: {}, errors: [] })
  saveGlobalConfig(current => ({
    ...current,
    model: undefined,
    logoColor: undefined,
  }))
})

afterEach(() => {
  resetSettingsCache()
  saveGlobalConfig(current => ({
    ...current,
    model: undefined,
    logoColor: undefined,
  }))
  ;(globalThis as Record<string, unknown>).MACRO = originalMacro
  Object.defineProperty(process.stdout, 'isTTY', {
    configurable: true,
    value: originalIsTTY,
  })
  process.stdout.write = originalWrite
  for (const key of ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = originalEnv[key]
    }
  }
})

function setupOpenAIMode(baseUrl: string, model: string): void {
  process.env.CLAUDE_CODE_USE_OPENAI = '1'
  process.env.OPENAI_BASE_URL = baseUrl
  process.env.OPENAI_MODEL = model
  process.env.OPENAI_API_KEY = 'test-key'
}

function captureStartupScreenOutput(modelOverride?: string): { raw: string; plain: string } {
  let output = ''
  process.stdout.write = ((chunk: string | Uint8Array) => {
    output += chunk.toString()
    return true
  }) as typeof process.stdout.write

  printStartupScreen(modelOverride)
  return { raw: output, plain: stripAnsi(output) }
}

// ─── Quantum Startup Splash Screen End-to-End Rendering ─────────────────────

describe('printStartupScreen — Quantum Splash UI', () => {
  beforeEach(() => {
    ;(globalThis as Record<string, unknown>).MACRO = {
      VERSION: '1.0.0',
      DISPLAY_VERSION: '1.0.0',
    }
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: true,
    })
  })

  test('renders the full Quantum banner, tagline, info box, and version', () => {
    const { plain } = captureStartupScreenOutput()

    // 1. ASCII Art QUANTUM banner block lines
    expect(plain).toContain('██████╗')
    expect(plain).toContain('██╔═══██╗')
    expect(plain).toContain('██║   ██║')
    expect(plain).toContain('╚██████╔╝')

    // 2. Tagline
    expect(plain).toContain('✦ Any model. Every tool. Zero limits. ✦')

    // 3. Info box headers and frame
    expect(plain).toContain('╔════════════════════════════════════════════════════════════╗')
    expect(plain).toContain('│ Provider  Anthropic')
    expect(plain).toContain('│ Model     claude-sonnet-4-6')
    expect(plain).toContain('│ Endpoint  https://api.anthropic.com')
    expect(plain).toContain('╠════════════════════════════════════════════════════════════╣')
    expect(plain).toContain('│ ● cloud    Ready — type /help to begin')
    expect(plain).toContain('╚════════════════════════════════════════════════════════════╝')

    // 4. Version line
    expect(plain).toContain('quantum v1.0.0')
  })

  test('renders local provider status and indicators for localhost endpoints', () => {
    setupOpenAIMode('http://localhost:11434/v1', 'qwen2.5-coder:7b')

    const { plain } = captureStartupScreenOutput()
    expect(plain).toContain('│ Provider  Ollama')
    expect(plain).toContain('│ Model     qwen2.5-coder:7b')
    expect(plain).toContain('│ Endpoint  http://localhost:11434/v1')
    expect(plain).toContain('│ ● local    Ready — type /help to begin')
  })

  test('truncates very long endpoints with ellipsis to preserve box alignment', () => {
    const longUrl = 'https://very-long-custom-private-gateway.internal.subdomain.company.domain.com/v1/endpoints/chat'
    setupOpenAIMode(longUrl, 'custom-model')

    const { plain } = captureStartupScreenOutput()
    expect(plain).toContain('Endpoint  https://very-long-custom-private-ga...')
    // Verifies box width integrity
    const lines = plain.split('\n').filter(l => l.startsWith('│'))
    for (const line of lines) {
      expect(line.endsWith('│')).toBe(true)
      expect(line.length).toBe(62)
    }
  })

  test('respects palette configuration from global config', () => {
    saveGlobalConfig(current => ({
      ...current,
      logoColor: 'ocean',
    }))

    const { raw } = captureStartupScreenOutput()
    const ocean = LOGO_PALETTES.ocean
    // Verify ANSI RGB color codes from ocean palette are present
    expect(raw).toContain(`\x1b[38;2;${ocean.accent[0]};${ocean.accent[1]};${ocean.accent[2]}m`)
    expect(raw).toContain(`\x1b[38;2;${ocean.border[0]};${ocean.border[1]};${ocean.border[2]}m`)
  })

  test('paintLine applies color gradient smoothly across characters', () => {
    const line = 'QUANTUM'
    const gradient = LOGO_PALETTES.sunset.gradient
    const rendered = paintLine(line, gradient, 0.5)
    expect(rendered).toContain('Q')
    expect(rendered).toContain('M')
    expect(stripAnsi(rendered)).toBe(line)
  })

  test('skips printing completely in CI environment', () => {
    process.env.CI = '1'
    const { raw } = captureStartupScreenOutput()
    expect(raw).toBe('')
  })

  test('skips printing when stdout is not a TTY (pipe / redirect)', () => {
    Object.defineProperty(process.stdout, 'isTTY', {
      configurable: true,
      value: false,
    })
    const { raw } = captureStartupScreenOutput()
    expect(raw).toBe('')
  })

  test('modelOverride overrides model displayed in startup screen box', () => {
    const { plain } = captureStartupScreenOutput('claude-3-5-haiku-20241022')
    expect(plain).toContain('Model     claude-3-5-haiku-20241022')
  })
})

// ─── Provider Detection End-to-End ──────────────────────────────────────────

describe('detectProvider — Aggregators & Gateways (#855)', () => {
  test('OpenRouter + deepseek/deepseek-chat labels as OpenRouter', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'deepseek/deepseek-chat')
    expect(detectProvider().name).toBe('OpenRouter')
  })

  test('OpenRouter + moonshotai/kimi-k2 labels as OpenRouter', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'moonshotai/kimi-k2')
    expect(detectProvider().name).toBe('OpenRouter')
  })

  test('OpenRouter + mistralai/mistral-large labels as OpenRouter', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'mistralai/mistral-large')
    expect(detectProvider().name).toBe('OpenRouter')
  })

  test('OpenRouter + meta-llama/llama-3.3 labels as OpenRouter', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'meta-llama/llama-3.3-70b-instruct')
    expect(detectProvider().name).toBe('OpenRouter')
  })

  test('Together + deepseek-ai/DeepSeek-V3 labels as Together AI', () => {
    setupOpenAIMode('https://api.together.xyz/v1', 'deepseek-ai/DeepSeek-V3')
    expect(detectProvider().name).toBe('Together AI')
  })

  test('Together + meta-llama/Llama-3.3 labels as Together AI', () => {
    setupOpenAIMode('https://api.together.xyz/v1', 'meta-llama/Llama-3.3-70B-Instruct-Turbo')
    expect(detectProvider().name).toBe('Together AI')
  })

  test('Groq + deepseek-r1-distill-llama-70b labels as Groq', () => {
    setupOpenAIMode('https://api.groq.com/openai/v1', 'deepseek-r1-distill-llama-70b')
    expect(detectProvider().name).toBe('Groq')
  })

  test('Groq + llama-3.3-70b-versatile labels as Groq', () => {
    setupOpenAIMode('https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile')
    expect(detectProvider().name).toBe('Groq')
  })

  test('Azure + any deepseek deployment labels as Azure OpenAI', () => {
    setupOpenAIMode('https://my-resource.openai.azure.com/', 'deepseek-chat')
    expect(detectProvider().name).toBe('Azure OpenAI')
  })
})

describe('detectProvider — Direct Vendor Endpoints', () => {
  test('api.deepseek.com labels as DeepSeek', () => {
    setupOpenAIMode('https://api.deepseek.com/v1', 'deepseek-chat')
    expect(detectProvider().name).toBe('DeepSeek')
  })

  test('api.kimi.com labels as Moonshot AI - Kimi Code', () => {
    setupOpenAIMode('https://api.kimi.com/coding/v1', 'kimi-for-coding')
    expect(detectProvider().name).toBe('Moonshot AI - Kimi Code')
  })

  test('api.moonshot.cn labels as Moonshot AI - API', () => {
    setupOpenAIMode('https://api.moonshot.cn/v1', 'moonshot-v1-8k')
    expect(detectProvider().name).toBe('Moonshot AI - API')
  })

  test('api.mistral.ai labels as Mistral AI from route metadata', () => {
    setupOpenAIMode('https://api.mistral.ai/v1', 'mistral-large-latest')
    expect(detectProvider().name).toBe('Mistral AI')
  })

  test('api.z.ai labels as Z.AI from route metadata', () => {
    setupOpenAIMode('https://api.z.ai/api/coding/paas/v4', 'GLM-5.1')
    expect(detectProvider().name).toBe('Z.AI')
  })

  test('default OpenAI URL + gpt-4o labels as OpenAI', () => {
    setupOpenAIMode('https://api.openai.com/v1', 'gpt-4o')
    expect(detectProvider().name).toBe('OpenAI')
  })
})

describe('detectProvider — Generic/Custom Proxy Fallbacks', () => {
  test('custom proxy + deepseek-chat falls back to DeepSeek', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'deepseek-chat')
    expect(detectProvider().name).toBe('DeepSeek')
  })

  test('custom proxy + kimi-for-coding falls back to Moonshot AI - Kimi Code', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'kimi-for-coding')
    expect(detectProvider().name).toBe('Moonshot AI - Kimi Code')
  })

  test('custom proxy + kimi-k2 falls back to Moonshot AI - API', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'kimi-k2-instruct')
    expect(detectProvider().name).toBe('Moonshot AI - API')
  })

  test('custom proxy + llama-3.3 falls back to Meta Llama', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'llama-3.3-70b')
    expect(detectProvider().name).toBe('Meta Llama')
  })

  test('custom proxy + mistral-large falls back to Mistral', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'mistral-large-latest')
    expect(detectProvider().name).toBe('Mistral')
  })

  test('custom proxy + exact uppercase GLM ID stays generic without route metadata', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'GLM-5.1')
    expect(detectProvider().name).toBe('OpenAI')
  })

  test('custom proxy + lowercase glm ID stays generic OpenAI', () => {
    setupOpenAIMode('https://my-proxy.internal/v1', 'glm-5.1')
    expect(detectProvider().name).toBe('OpenAI')
  })

  test('DashScope lowercase glm ID is not mislabeled as Z.AI', () => {
    setupOpenAIMode('https://dashscope.aliyuncs.com/compatible-mode/v1', 'glm-5.1')
    expect(detectProvider().name).toBe('OpenAI')
  })
})

describe('detectProvider — Dedicated Provider Env Flags', () => {
  test('NVIDIA_NIM=1 overrides aggregator URL', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'some-nim-model')
    process.env.NVIDIA_NIM = '1'
    expect(detectProvider().name).toBe('NVIDIA NIM')
  })

  test('MINIMAX_API_KEY overrides aggregator URL', () => {
    setupOpenAIMode('https://openrouter.ai/api/v1', 'any-model')
    process.env.MINIMAX_API_KEY = 'test-key'
    expect(detectProvider().name).toBe('MiniMax')
  })
})

describe('detectProvider — Model Flags, Aliases & Overrides', () => {
  test('modelOverride overrides default Anthropic model', () => {
    const result = detectProvider('claude-opus-4-6')
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('opus')
  })

  test('modelOverride alias is resolved for Anthropic', () => {
    const result = detectProvider('opus')
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('opus')
  })

  test('modelOverride takes priority over ANTHROPIC_MODEL env var', () => {
    process.env.ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001'
    const result = detectProvider('claude-opus-4-6')
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('opus')
  })

  test('modelOverride takes priority over CLAUDE_MODEL env var', () => {
    process.env.CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
    const result = detectProvider('claude-opus-4-6')
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('opus')
  })

  test('modelOverride works for OpenAI provider', () => {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    process.env.OPENAI_API_KEY = 'test-key'
    process.env.OPENAI_MODEL = 'gpt-4o'
    const result = detectProvider('gpt-4-turbo')
    expect(result.model).toContain('gpt-4-turbo')
  })

  test('modelOverride works for Gemini provider', () => {
    process.env.CLAUDE_CODE_USE_GEMINI = '1'
    const result = detectProvider('gemini-2.5-pro')
    expect(result.model).toBe('gemini-2.5-pro')
  })

  test('modelOverride works for Mistral provider', () => {
    process.env.CLAUDE_CODE_USE_MISTRAL = '1'
    const result = detectProvider('mistral-large-latest')
    expect(result.model).toBe('mistral-large-latest')
  })

  test('modelOverride works for GitHub provider', () => {
    process.env.CLAUDE_CODE_USE_GITHUB = '1'
    const result = detectProvider('gpt-4o')
    expect(result.model).toContain('gpt-4o')
  })

  test('undefined modelOverride preserves default behavior', () => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6'
    const result = detectProvider(undefined)
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('sonnet')
  })

  test('no argument preserves default behavior', () => {
    process.env.ANTHROPIC_MODEL = 'claude-sonnet-4-6'
    const result = detectProvider()
    expect(result.name).toBe('Anthropic')
    expect(result.model).toContain('sonnet')
  })
})

