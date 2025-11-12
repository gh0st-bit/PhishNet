describe('performance placeholder', () => {
	it('runs a placeholder assertion', () => {
		const start = Date.now();
		const end = Date.now();
		expect(end - start).toBeGreaterThanOrEqual(0);
	});
});
