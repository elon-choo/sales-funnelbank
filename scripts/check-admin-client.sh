#!/bin/bash
# scripts/check-admin-client.sh
# createAdminClient 사용처 검증 스크립트 (T20 PT-006, T13 코딩 컨벤션)
# CI에서 자동 실행되어 허용되지 않은 파일에서 createAdminClient 사용 시 빌드 실패

set -e

echo "🔍 Checking createAdminClient usage..."

# 허용된 파일 목록 (화이트리스트)
# - 인증 관련: 토큰 검증, 리프레시, 로그아웃 등
# - LMS 관련: 가드, 감사 로그, Cron
# - Edge Function: Supabase Functions
ALLOWED_FILES=(
  "src/lib/supabase/admin.ts"
  "src/lib/lms/auditLog.ts"
  "src/lib/lms/cronHandler.ts"
  "src/lib/lms/guards.ts"
  "src/lib/auth/guards.ts"
  "src/lib/auth/rotation.ts"
  "src/lib/ai/tokenManager.ts"
  "src/app/api/auth/"
  "supabase/functions/"
)

# createAdminClient 사용처 검색
USAGE_FILES=$(grep -rl "createAdminClient" --include="*.ts" --include="*.tsx" src/ supabase/ 2>/dev/null || true)

VIOLATIONS=""

for file in $USAGE_FILES; do
  ALLOWED=false

  for allowed in "${ALLOWED_FILES[@]}"; do
    if [[ "$file" == *"$allowed"* ]]; then
      ALLOWED=true
      break
    fi
  done

  if [ "$ALLOWED" = false ]; then
    VIOLATIONS="$VIOLATIONS\n  - $file"
  fi
done

if [ -n "$VIOLATIONS" ]; then
  echo ""
  echo "❌ createAdminClient usage violation detected!"
  echo ""
  echo "The following files use createAdminClient but are not in the whitelist:"
  echo -e "$VIOLATIONS"
  echo ""
  echo "Allowed files:"
  for allowed in "${ALLOWED_FILES[@]}"; do
    echo "  ✓ $allowed"
  done
  echo ""
  echo "If this usage is intentional, add the file to ALLOWED_FILES in this script."
  echo "Otherwise, use createClient() or createServerClient() instead."
  exit 1
fi

echo "✅ All createAdminClient usages are in allowed files."
echo ""
echo "Files using createAdminClient:"
for file in $USAGE_FILES; do
  echo "  ✓ $file"
done

exit 0
