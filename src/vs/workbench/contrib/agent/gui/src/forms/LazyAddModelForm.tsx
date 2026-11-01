import { lazy, Suspense } from "react";
import type { AddModelFormProps } from "./AddModelForm";

const AddModelForm = lazy(() =>
	import("./AddModelForm").then(({ AddModelForm }) => ({
		default: AddModelForm,
	})),
);

export function LazyAddModelForm(props: AddModelFormProps) {
	return (
		<Suspense fallback={null}>
			<AddModelForm {...props} />
		</Suspense>
	);
}
