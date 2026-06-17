import eslintjs from "@eslint/js";
import {defineConfig} from "eslint/config";
import globals from "globals";

export default defineConfig([
  {
    plugins: {
      'js': eslintjs
    },
    extends: [
      'js/recommended'
    ],
    languageOptions: {
      globals: {
        ...globals.node
      }
    },
    rules: {
    },
  },
  {
    files: [
      'test/testBrowsers.js'
    ],
    languageOptions: {
      globals: {
        ...globals.browser
      }
    }
  },
  {
    files: [
      'test/data/demo/service-worker.js'
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.serviceworker
      }
    }
  }
]);
