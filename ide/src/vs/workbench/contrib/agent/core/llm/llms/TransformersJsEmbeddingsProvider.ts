import { LLMOptions } from "../../index.js";
import { BaseLLM } from "../../llm/index.js";
import { getEmbeddingModelsPath } from "../../util/paths.js";

class EmbeddingsPipeline {
  static task = "feature-extraction" as const;
  static model = "all-MiniLM-L6-v2";
  static instance: any | null = null;

  static async getInstance() {
    if (EmbeddingsPipeline.instance === null) {
      const { env, pipeline } = await import("@xenova/transformers");

      // Prefer the on-disk cache under ~/.agent/models. Remote HuggingFace
      // download is allowed only so the first run can populate that cache;
      // nothing is uploaded and no product telemetry is involved.
      env.allowLocalModels = true;
      env.allowRemoteModels = true;
      env.localModelPath = getEmbeddingModelsPath();

      EmbeddingsPipeline.instance = await pipeline(
        EmbeddingsPipeline.task,
        EmbeddingsPipeline.model,
      );
    }

    return EmbeddingsPipeline.instance;
  }
}

export class TransformersJsEmbeddingsProvider extends BaseLLM {
  static providerName = "transformers.js";
  static maxGroupSize: number = 1;
  static model: string = "all-MiniLM-L6-v2";
  static mockVector: number[] = Array.from({ length: 384 }).fill(2) as number[];

  static defaultOptions: Partial<LLMOptions> | undefined = {
    model: TransformersJsEmbeddingsProvider.model,
  };

  constructor() {
    super({
      model: TransformersJsEmbeddingsProvider.model,
      title: "Transformers.js (Built-In)",
    });
  }

  async embed(chunks: string[]) {
    // Workaround to ignore testing issues in Jest
    if (process.env.NODE_ENV === "test") {
      return chunks.map(() => TransformersJsEmbeddingsProvider.mockVector);
    }

    const extractor = await EmbeddingsPipeline.getInstance();

    if (!extractor) {
      throw new Error("TransformerJS embeddings pipeline is not initialized");
    }

    if (chunks.length === 0) {
      return [];
    }

    const outputs = [];
    for (
      let i = 0;
      i < chunks.length;
      i += TransformersJsEmbeddingsProvider.maxGroupSize
    ) {
      const chunkGroup = chunks.slice(
        i,
        i + TransformersJsEmbeddingsProvider.maxGroupSize,
      );
      const output = await extractor(chunkGroup, {
        pooling: "mean",
        normalize: true,
      });
      // To avoid causing the extension host to go unresponsive
      await new Promise((resolve) => setTimeout(resolve, 10));
      outputs.push(...output.tolist());
    }
    return outputs;
  }
}

export default TransformersJsEmbeddingsProvider;
