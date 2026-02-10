// src/app/(lms)/lms/profile/page.tsx
'use client';

import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

export default function ProfilePage() {
  const { user } = useAuthStore();

  if (!user) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500" />
      </div>
    );
  }

  const courseLabel = user.courseType === 'MAGNETIC_SALES' ? '마그네틱 세일즈' : '세일즈 퍼널 마스터클래스';

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-white">내 프로필</h1>

      <div className="bg-slate-800/50 rounded-2xl border border-slate-700 overflow-hidden">
        {/* Avatar & Name */}
        <div className="bg-gradient-to-r from-purple-900/40 to-pink-900/40 p-8 text-center">
          <div className="w-20 h-20 bg-purple-600/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl font-bold text-purple-400">
              {(user.fullName || user.email)?.[0]?.toUpperCase() || '?'}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white">{user.fullName || '이름 미설정'}</h2>
          <p className="text-slate-400 text-sm mt-1">{user.email}</p>
        </div>

        {/* Info Grid */}
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <InfoItem label="과정" value={courseLabel} />
            <InfoItem label="플랜" value={user.tier} color="text-purple-400" />
            <InfoItem label="역할" value={user.role === 'admin' ? '관리자' : '수강생'} />
            <InfoItem
              label="승인 상태"
              value={user.isApproved ? '승인됨' : '대기중'}
              color={user.isApproved ? 'text-green-400' : 'text-yellow-400'}
            />
          </div>

          <div className="pt-4 border-t border-slate-700">
            <InfoItem label="가입일" value={new Date(user.createdAt).toLocaleDateString('ko-KR')} />
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          href="/lms/assignments"
          className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-purple-500/50 transition-colors text-center"
        >
          <p className="text-white font-medium">내 과제</p>
          <p className="text-slate-400 text-xs mt-1">제출한 과제 확인</p>
        </Link>
        <Link
          href="/lms/feedbacks"
          className="bg-slate-800/50 rounded-xl p-4 border border-slate-700 hover:border-purple-500/50 transition-colors text-center"
        >
          <p className="text-white font-medium">AI 피드백</p>
          <p className="text-slate-400 text-xs mt-1">피드백 리포트 확인</p>
        </Link>
      </div>
    </div>
  );
}

function InfoItem({ label, value, color = 'text-white' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`font-medium ${color}`}>{value}</p>
    </div>
  );
}
