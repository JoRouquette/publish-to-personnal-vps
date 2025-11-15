// commitlint.config.cjs
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',
        'fix',
        'hotfix',
        'perf',
        'refactor',
        'revert',
        'build',
        'ci',
        'docs',
        'style',
        'test',
        'chore',
      ],
    ],
  },
};
