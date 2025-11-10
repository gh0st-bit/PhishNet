import { createHash } from 'node:crypto';

describe('Auth utilities', () => {
	it('hashes password consistently (demo)', () => {
		const hash1 = createHash('sha256').update('secret').digest('hex');
		const hash2 = createHash('sha256').update('secret').digest('hex');
		expect(hash1).toBe(hash2);
		expect(hash1).toHaveLength(64);
	});
});
