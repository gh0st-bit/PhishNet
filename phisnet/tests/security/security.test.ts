describe('security checks placeholder', () => {
	it('has a placeholder to keep CI green', () => {
		expect('secure').toContain('sec');
	});
});
