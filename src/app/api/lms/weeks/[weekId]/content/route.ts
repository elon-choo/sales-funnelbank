// src/app/api/lms/weeks/[weekId]/content/route.ts
// 주차별 콘텐츠 에디터 API
import { NextRequest, NextResponse } from 'next/server';
import { withLmsAuth, withLmsAdminAuth } from '@/lib/lms/guards';

interface RouteParams {
  params: Promise<{ weekId: string }>;
}

// GET /api/lms/weeks/[weekId]/content - 주차 콘텐츠 조회
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;

  return withLmsAuth(request, async (auth, supabase) => {
    try {
      // 주차 정보 조회
      const { data: week, error: weekError } = await supabase
        .from('course_weeks')
        .select(`
          id,
          course_id,
          week_number,
          title,
          description,
          assignment_type,
          deadline,
          is_active,
          content_json,
          video_url,
          materials,
          created_at,
          updated_at
        `)
        .eq('id', weekId)
        .is('deleted_at', null)
        .single();

      if (weekError || !week) {
        return NextResponse.json(
          { success: false, error: { code: 'NOT_FOUND', message: '주차를 찾을 수 없습니다' } },
          { status: 404 }
        );
      }

      // 학생인 경우 수강 등록 확인
      if (auth.lmsRole !== 'admin' && auth.tier !== 'ENTERPRISE') {
        const { data: enrollment } = await supabase
          .from('course_enrollments')
          .select('id')
          .eq('user_id', auth.userId)
          .eq('course_id', week.course_id)
          .eq('status', 'active')
          .is('deleted_at', null)
          .single();

        if (!enrollment) {
          return NextResponse.json(
            { success: false, error: { code: 'FORBIDDEN', message: '수강 등록이 필요합니다' } },
            { status: 403 }
          );
        }
      }

      // 과제 필드 설정 조회
      const { data: fieldConfigs } = await supabase
        .from('week_assignment_configs')
        .select('*')
        .eq('week_id', weekId)
        .is('deleted_at', null)
        .order('sort_order', { ascending: true });

      return NextResponse.json({
        success: true,
        data: {
          week,
          fieldConfigs: fieldConfigs || [],
        },
      });
    } catch (error) {
      console.error('[Week Content GET Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}

// PATCH /api/lms/weeks/[weekId]/content - 주차 콘텐츠 업데이트 (관리자)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { weekId } = await params;

  return withLmsAdminAuth(request, async (auth, supabase) => {
    try {
      const body = await request.json();
      const {
        title,
        description,
        assignmentType,
        deadline,
        isActive,
        contentJson,
        videoUrl,
        materials,
        fieldConfigs,
      } = body;

      // 주차 정보 업데이트
      const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (title !== undefined) updateData.title = title;
      if (description !== undefined) updateData.description = description;
      if (assignmentType !== undefined) updateData.assignment_type = assignmentType;
      if (deadline !== undefined) updateData.deadline = deadline;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (contentJson !== undefined) updateData.content_json = contentJson;
      if (videoUrl !== undefined) updateData.video_url = videoUrl;
      if (materials !== undefined) updateData.materials = materials;

      const { error: updateError } = await supabase
        .from('course_weeks')
        .update(updateData)
        .eq('id', weekId);

      if (updateError) {
        console.error('[Week Content PATCH Error]', updateError);
        return NextResponse.json(
          { success: false, error: { code: 'DB_ERROR', message: '주차 정보 저장 실패' } },
          { status: 500 }
        );
      }

      // 필드 설정 업데이트 (있는 경우)
      if (fieldConfigs && Array.isArray(fieldConfigs)) {
        // 기존 필드 소프트 삭제
        await supabase
          .from('week_assignment_configs')
          .update({ deleted_at: new Date().toISOString() })
          .eq('week_id', weekId);

        // 새 필드 삽입
        if (fieldConfigs.length > 0) {
          const newConfigs = fieldConfigs.map((config: Record<string, unknown>, index: number) => ({
            week_id: weekId,
            field_key: config.fieldKey || `field_${index}`,
            field_label: config.fieldLabel || `필드 ${index + 1}`,
            field_type: config.fieldType || 'textarea',
            placeholder: config.placeholder || null,
            help_text: config.helpText || null,
            is_required: config.isRequired ?? true,
            sort_order: index,
          }));

          const { error: insertError } = await supabase
            .from('week_assignment_configs')
            .insert(newConfigs);

          if (insertError) {
            console.error('[Field Config Insert Error]', insertError);
          }
        }
      }

      return NextResponse.json({
        success: true,
        data: { updated: true },
      });
    } catch (error) {
      console.error('[Week Content PATCH Error]', error);
      return NextResponse.json(
        { success: false, error: { code: 'SERVER_ERROR', message: '서버 오류' } },
        { status: 500 }
      );
    }
  });
}
