import Fireworks from "./Fireworks.js";
import { createOpenAISubclassTests } from "./test-utils/openai-test-utils.js";

createOpenAISubclassTests(Fireworks, {
  providerName: "fireworks",
  defaultApiBase: "https://api.fireworks.ai/inference/v1/",
  modelConversionContent:
    "<|im_start|>user\nhello<|im_end|>\n<|im_start|>assistant\n",
});
