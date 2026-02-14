// src/app/api/lms/admin/prompts/route.ts
// 주차별 프롬프트 관리 API (버전 관리 포함)
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAdminAuth } from '@/lib/lms/guards';

// GET: 프롬프트 목록 (주차별)
export async function GET(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    const { searchParams } = new URL(request.url);
    const weekKey = searchParams.get('weekKey');

    try {
      let query = supabase
        .from('prompt_versions')
        .select('id, week_key, version, content, is_active, created_by, change_note, created_at')
        .order('week_key', { ascending: true })
        .order('version', { ascending: false });

      if (weekKey) {
        query = query.eq('week_key', weekKey);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Group by week_key
      const grouped: Record<string, typeof data> = {};
      for (const row of data || []) {
        if (!grouped[row.week_key]) grouped[row.week_key] = [];
        grouped[row.week_key].push(row);
      }

      return NextResponse.json({ success: true, data: { prompts: grouped, all: data } });
    } catch (error) {
      console.error('[Prompts GET Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '프롬프트 조회 실패' } },
        { status: 500 }
      );
    }
  });
}

// POST: 새 프롬프트 버전 생성
export async function POST(request: NextRequest) {
  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const { weekKey, content, changeNote } = await request.json();

      if (!weekKey || !content) {
        return NextResponse.json(
          { success: false, error: { message: 'weekKey와 content는 필수입니다' } },
          { status: 400 }
        );
      }

      // Get current max version
      const { data: existing } = await supabase
        .from('prompt_versions')
        .select('version')
        .eq('week_key', weekKey)
        .order('version', { ascending: false })
        .limit(1);

      const nextVersion = (existing?.[0]?.version || 0) + 1;

      // Deactivate all previous versions
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('week_key', weekKey);

      // Insert new version
      const { data: newVersion, error } = await supabase
        .from('prompt_versions')
        .insert({
          week_key: weekKey,
          version: nextVersion,
          content,
          is_active: true,
          created_by: auth.userId,
          change_note: changeNote || `v${nextVersion} 저장`,
        })
        .select()
        .single();

      if (error) throw error;

      // Also update system_settings for backward compatibility
      // JSONB column: store as raw string, not JSON.stringify (which would double-escape)
      const settingsKey = weekKey === 'week1' ? 'feedback_master_prompt' : `feedback_master_prompt_${weekKey}`;
      await supabase
        .from('system_settings')
        .upsert({ key: settingsKey, value: content }, { onConflict: 'key' });

      return NextResponse.json({
        success: true,
        data: { prompt: newVersion },
      });
    } catch (error) {
      console.error('[Prompts POST Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '프롬프트 저장 실패' } },
        { status: 500 }
      );
    }
  });
}

// PATCH: 특정 버전 활성화
export async function PATCH(request: NextRequest) {
  return withLmsAdminAuth(request, async (_auth, supabase) => {
    try {
      const { weekKey, versionId } = await request.json();

      if (!weekKey || !versionId) {
        return NextResponse.json(
          { success: false, error: { message: 'weekKey와 versionId는 필수입니다' } },
          { status: 400 }
        );
      }

      // Get the version content
      const { data: version } = await supabase
        .from('prompt_versions')
        .select('content, version')
        .eq('id', versionId)
        .single();

      if (!version) {
        return NextResponse.json(
          { success: false, error: { message: '버전을 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // Deactivate all, activate selected
      await supabase
        .from('prompt_versions')
        .update({ is_active: false })
        .eq('week_key', weekKey);

      await supabase
        .from('prompt_versions')
        .update({ is_active: true })
        .eq('id', versionId);

      // Update system_settings (JSONB column - store raw, not JSON.stringify)
      const settingsKey = weekKey === 'week1' ? 'feedback_master_prompt' : `feedback_master_prompt_${weekKey}`;
      await supabase
        .from('system_settings')
        .upsert({ key: settingsKey, value: version.content }, { onConflict: 'key' });

      return NextResponse.json({
        success: true,
        data: { activatedVersion: version.version },
      });
    } catch (error) {
      console.error('[Prompts PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { message: '버전 활성화 실패' } },
        { status: 500 }
      );
    }
  });
}
