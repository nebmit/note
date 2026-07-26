import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import globals from 'globals';
import ts from 'typescript-eslint';
import svelteConfig from './svelte.config.js';

export default ts.config(
    {
        ignores: ['.svelte-kit/', 'build/', 'node_modules/']
    },
    js.configs.recommended,
    ...ts.configs.recommended,
    ...svelte.configs.recommended,
    {
        languageOptions: {
            globals: { ...globals.browser, ...globals.node }
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1 }],
            semi: ['error', 'always'],
            'space-before-function-paren': ['error', {
                anonymous: 'never',
                named: 'never',
                asyncArrow: 'always'
            }]
        }
    },
    {
        files: ['**/*.svelte', '**/*.svelte.ts'],
        languageOptions: {
            parserOptions: {
                projectService: true,
                extraFileExtensions: ['.svelte'],
                parser: ts.parser,
                svelteConfig
            }
        },
        rules: {
            // Svelte's formatting of markup expressions does not line up with the
            // 4-space rule, and svelte-eslint-parser reports spurious violations.
            indent: 'off'
        }
    }
);
