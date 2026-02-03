// eslint.config.mjs
// 세퍼마 LMS ESLint 설정 (T13 코딩 컨벤션 기반)
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),

  // LMS 전용 규칙
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      // TypeScript 엄격 모드
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],

      // 콘솔 경고 (production 빌드 전 제거 필요)
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // createAdminClient 사용 제한 (CTO-007, T20 PT-006)
  {
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      // 허용된 파일들
      "**/lib/lms/auditLog.ts",
      "**/lib/lms/cronHandler.ts",
      "**/lib/supabase/admin.ts",
      "**/supabase/functions/**",
    ],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/lib/supabase/admin",
              importNames: ["createAdminClient"],
              message: "createAdminClient는 감사로그, Cron, Edge Function에서만 사용 가능합니다. 일반 쿼리는 createClient를 사용하세요.",
            },
          ],
          patterns: [
            {
              group: ["**/admin*"],
              importNamePattern: "^createAdminClient$",
              message: "createAdminClient는 허용된 모듈에서만 import 가능합니다.",
            },
          ],
        },
      ],
    },
  },

  // API Routes 보안 규칙
  {
    files: ["**/app/api/**/*.ts"],
    rules: {
      // API에서 console.log 금지
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // 테스트 파일 규칙 완화
  {
    files: ["**/*.test.ts", "**/*.test.tsx", "**/*.spec.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
];

export default eslintConfig;
