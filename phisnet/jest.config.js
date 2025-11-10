/** Jest configuration for TypeScript + React components */
export default {
	testEnvironment: 'jsdom',
	roots: ['<rootDir>/client/src', '<rootDir>/server', '<rootDir>/tests'],
	moduleNameMapper: {
		'^@/(.*)$': '<rootDir>/client/src/$1',
		'^@shared/(.*)$': '<rootDir>/shared/$1'
	},
	setupFilesAfterEnv: ['<rootDir>/tests/setup-after-env.ts'],
	transform: {
		'^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }]
	},
	moduleFileExtensions: ['ts','tsx','js','jsx','json'],
	testMatch: ['**/*.test.(ts|tsx)']
};
