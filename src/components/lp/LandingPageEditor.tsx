
// src/components/lp/LandingPageEditor.tsx
'use client';

import { useEffect } from 'react';
import { useLpStore } from '@/stores/lpStore';
import { Button } from '@/components/ui/button';
import { Icons } from '@/components/icons';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/navigation';
import SectionRenderer from '@/components/lp/SectionRenderer';

export default function LandingPageEditor() {
    const { page, addSection, updateTitle, isSaving, removeSection, moveSection, updateSection } = useLpStore();
    const router = useRouter();

    const handleSave = async () => {
        try {
            const response = await fetch('/api/lp/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: page.title,
                    content: page
                })
            });

            if (!response.ok) throw new Error('저장 실패');
            const data = await response.json();
            alert('저장됨! ID: ' + data.id);
        } catch (e) {
            console.error(e);
            alert('저장에 실패했습니다');
        }
    };

    return (
        <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar - Tools */}
            <aside className="w-64 bg-gray-950 border-r border-gray-800 p-4 flex flex-col gap-4">
                <div className="font-bold text-lg text-purple-400 flex items-center gap-2">
                    <Icons.layout className="w-5 h-5" />
                    <span>빌더</span>
                </div>

                <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-medium uppercase">섹션</label>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => addSection('hero')}>
                        <Icons.plus className="w-4 h-4 mr-2" /> 히어로
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => addSection('features')}>
                        <Icons.plus className="w-4 h-4 mr-2" /> 기능
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => addSection('pricing')}>
                        <Icons.plus className="w-4 h-4 mr-2" /> 요금제
                    </Button>
                    <Button variant="outline" className="w-full justify-start text-left" onClick={() => addSection('cta')}>
                        <Icons.plus className="w-4 h-4 mr-2" /> 행동유도
                    </Button>
                </div>

                <div className="mt-auto space-y-2">
                    <Button className="w-full bg-purple-600 hover:bg-purple-500" onClick={handleSave} disabled={isSaving}>
                        {isSaving ? '저장 중...' : '페이지 저장'}
                    </Button>
                </div>
            </aside>

            {/* Main Preview Area */}
            <main className="flex-1 flex flex-col h-full relative">
                {/* Top Bar */}
                <header className="h-14 bg-gray-950 border-b border-gray-800 flex items-center px-4 justify-between">
                    <div className="flex items-center gap-4">
                        <Input
                            value={page.title}
                            onChange={(e) => updateTitle(e.target.value)}
                            className="bg-transparent border-none text-white focus:ring-0 w-64 text-lg font-medium"
                        />
                    </div>
                    <div className="text-sm text-gray-500">
                        미리보기 모드
                    </div>
                </header>

                {/* Canvas */}
                <div className="flex-1 overflow-y-auto p-0 bg-gray-900 scrollbar-thin scrollbar-thumb-gray-700">
                    <div className="max-w-full min-h-screen bg-black text-white shadow-2xl">
                        {page.sections.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-[80vh] text-gray-500">
                                <Icons.layout className="w-16 h-16 mb-4 opacity-20" />
                                <h3 className="text-xl font-medium text-gray-300 mb-2">빌딩 시작하기</h3>
                                <p>사이드바에서 블록을 선택하여 첫 번째 섹션을 추가하세요.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {page.sections.map((section, index) => (
                                    <div key={section.id} className="relative group hover:ring-2 hover:ring-purple-500/50 transition-all z-0 hover:z-10">
                                        {/* Section Toolbar (Hover) */}
                                        <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 shadow-xl rounded-lg p-1 z-50 border border-gray-700">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => {
                                                const newTitle = prompt("제목 수정:", section.content.title);
                                                if (newTitle) updateSection(section.id, { title: newTitle });
                                            }}>
                                                <Icons.edit className="w-4 h-4" />
                                            </Button>
                                            <div className="w-px h-6 bg-gray-700 my-auto mx-1" />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => moveSection(section.id, 'up')}>
                                                <Icons.arrowUp className="w-4 h-4" />
                                            </Button>
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => moveSection(section.id, 'down')}>
                                                <Icons.arrowDown className="w-4 h-4" />
                                            </Button>
                                            <div className="w-px h-6 bg-gray-700 my-auto mx-1" />
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => removeSection(section.id)}>
                                                <Icons.trash className="w-4 h-4" />
                                            </Button>
                                        </div>

                                        {/* Actual Render */}
                                        <SectionRenderer section={section} isEditing={true} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
