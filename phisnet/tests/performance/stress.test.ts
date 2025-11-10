describe('stress placeholder', () => {
	it('runs a placeholder assertion', () => {
		const items = new Array(10).fill(0).map((_, i) => i);
		expect(items.length).toBe(10);
	});
});
