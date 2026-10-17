import { expect, test } from 'bun:test';
import { increment } from './counter';

test('increment adds one', () => {
	expect(increment(2)).toBe(3);
});
