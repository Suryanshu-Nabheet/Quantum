import { visit } from "unist-util-visit";
import type { Node } from "unist";
import type { Root } from "hast";
import type { Plugin } from "unified";

/** Loads KaTeX only for Markdown that actually contains a math node. */
export function rehypeKatexOnDemand(): Plugin {
	return () => async (tree: Node, file) => {
		let containsMath = false;

		visit(tree as Root, "element", (node) => {
			const classNames = node.properties.className;
			if (
				Array.isArray(classNames) &&
				(classNames.includes("math-inline") ||
					classNames.includes("math-display"))
			) {
				containsMath = true;
			}
		});

		if (!containsMath) {
			return;
		}

		const rehypeKatex = (await import("rehype-katex")).default;
		return rehypeKatex()(
			tree as Root,
			file as Parameters<ReturnType<typeof rehypeKatex>>[1],
		);
	};
}
