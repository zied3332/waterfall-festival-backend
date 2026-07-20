/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',

  rootDir: '.',
  roots: ['<rootDir>/src'],

  testEnvironment: 'node',
  testRegex: '.*\\.spec\\.ts$',

  moduleFileExtensions: ['ts', 'js', 'json'],
  extensionsToTreatAsEsm: ['.ts'],

  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.spec.json',
        useESM: true,
      },
    ],
  },

  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },

  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.spec.ts',
    '!src/main.ts',
    '!src/generated/**',
  ],

  coverageDirectory: 'coverage',
};