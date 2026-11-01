import { describe, expect, it } from "vitest";
import remarkMath from "remark-math";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";
import { rehypeKatexOnDemand } from "./rehypeKatexOnDemand";

describe("rehypeKatexOnDemand", () => {
	it("leaves ordinary Markdown untouched", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkMath, { singleDollarTextMath: false })
			.use(remarkRehype)
			.use(rehypeKatexOnDemand());
		const tree = processor.parse("A normal Agent response.");
		const result = await processor.run(tree);

		expect(JSON.stringify(result)).not.toContain('"katex"');
	});

	it("renders display math through KaTeX", async () => {
		const processor = unified()
			.use(remarkParse)
			.use(remarkMath, { singleDollarTextMath: false })
			.use(remarkRehype)
			.use(rehypeKatexOnDemand());
		const tree = processor.parse("$$\nx^2 + 1\n$$");
		const result = await processor.run(tree);

		expect(JSON.stringify(result)).toContain('"katex"');
	});
});
