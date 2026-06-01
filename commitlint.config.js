/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nova funcionalidade
        'fix',      // Correção de bug
        'docs',     // Apenas documentação
        'style',    // Formatação, ponto e vírgula, etc (sem mudança de código)
        'refactor', // Refatoração de código
        'perf',     // Melhoria de performance
        'test',     // Adição ou correção de testes
        'chore',    // Mudanças em build, ferramentas, configs
        'ci',       // Mudanças em CI/CD
        'revert',   // Revert de commit anterior
      ],
    ],
    'subject-case': [2, 'always', 'sentence-case'],
    'body-max-line-length': [2, 'always', 100],
  },
};
