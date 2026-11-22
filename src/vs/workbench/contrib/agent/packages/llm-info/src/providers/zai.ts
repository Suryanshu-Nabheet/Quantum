import { ModelProvider } from "../types.js";

export const zAI: ModelProvider = {
  models: [
    {
      model: "glm-5.3",
      displayName: "GLM-5.3",
      contextLength: 1_000_000,
      recommendedFor: ["chat"],
      regex: /glm[-_. ]?5[-_. ]?3(?:$|[-_/ ])/i,
    },
    {
      model: "glm-5",
      displayName: "GLM-5",
      contextLength: 128000,
      recommendedFor: ["chat"],
      regex: /glm-5/,
    },
    {
      model: "glm-4.7",
      displayName: "GLM-4.7",
      contextLength: 128000,
      recommendedFor: ["chat"],
      regex: /glm-4\.7/,
    },
    {
      model: "glm-4-plus",
      displayName: "GLM-4 Plus",
      contextLength: 128000,
      recommendedFor: ["chat"],
      regex: /glm-4-plus/,
    },
    {
      model: "glm-4.5",
      displayName: "GLM-4.5",
      contextLength: 128000,
      recommendedFor: ["chat"],
      regex: /glm-4\.5/,
    },
  ],
  id: "zAI",
  displayName: "Z.ai",
};
