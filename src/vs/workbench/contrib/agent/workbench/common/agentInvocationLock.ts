/** Serializes asynchronous Agent invocations without holding a platform lock. */
export function createInvocationLock(): <T>(operation: () => Promise<T>) => Promise<T> {
	let tail: Promise<void> = Promise.resolve();
	return async <T>(operation: () => Promise<T>): Promise<T> => {
		const previous = tail;
		let release!: () => void;
		tail = new Promise<void>(resolve => release = resolve);
		await previous;
		try {
			return await operation();
		} finally {
			release();
		}
	};
}
