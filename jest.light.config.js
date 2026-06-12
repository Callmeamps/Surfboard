module.exports = {
  testEnvironment: 'jest-environment-jsdom',
  testPathIgnorePatterns: [
    '/node_modules/',
    '/test/e2e/',
  ],
  // No setupFilesAfterEnv — skip feature-platform eval for lightweight tests
};
