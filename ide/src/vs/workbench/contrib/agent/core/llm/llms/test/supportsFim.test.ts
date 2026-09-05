import { jest } from "@jest/globals";
import Anthropic from "../Anthropic.js";
import Deepseek from "../Deepseek.js";
import FunctionNetwork from "../FunctionNetwork.js";
import Mistral from "../Mistral.js";
import OpenAI from "../OpenAI.js";
import Vllm from "../Vllm.js";

const testCases: [any, string, boolean, string, string?][] = [
  [Vllm, "any-model", false, "Vllm"],
  [Anthropic, "claude-3-5-sonnet-latest", false, "Anthropic"],
  [FunctionNetwork, "any-model", false, "FunctionNetwork"],
  [OpenAI, "codestral", false, "OpenAI"],
  [Mistral, "codestral", true, "Mistral", "https://api.mistral.ai/v1/"],
  [Deepseek, "deepseek-chat", true, "Deepseek"],
];

testCases.forEach(([LLMClass, model, expectedResult, description, apiBase]) => {
  test(`supportsFim returns ${expectedResult} for ${description}`, () => {
    const llm = new LLMClass({
      model,
      apiKey: "test-key",
      ...(apiBase ? { apiBase } : {}),
    });

    const result = llm.supportsFim();

    expect(result).toBe(expectedResult);
  });
});
