'use client';

import { useState, useEffect } from 'react';

interface RagDataset {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  chunk_count: number;
  status: 'processing' | 'ready' | 'error';
  created_at: string;
}

interface RagMapping {
  id: string;
  week_id: string;
  rag_dataset_id: string;
  priority: number;
  course_weeks: {
    id: string;
    week_number: number;
    title: string;
    course_id: string;
    courses: {
      id: string;
      title: string;
    };
  };
  rag_datasets: {
    id: string;
    name: string;
    chunk_count: number;
    status: string;
  };
}

interface CourseWeek {
  id: string;
  week_number: number;
  title: string;
  course_id: string;
  courses: {
    id: string;
    title: string;
  };
}

export default function RagAdminPage() {
  const [datasets, setDatasets] = useState<RagDataset[]>([]);
  const [mappings, setMappings] = useState<RagMapping[]>([]);
  const [weeks, setWeeks] = useState<CourseWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'datasets' | 'mappings'>('datasets');

  // 데이터셋 생성 모달
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    description: '',
    category: '',
    content: '',
    chunkSize: 500,
    overlap: 50,
  });
  const [creating, setCreating] = useState(false);

  // 매핑 생성 모달
  const [showMappingModal, setShowMappingModal] = useState(false);
  const [mappingForm, setMappingForm] = useState({
    weekId: '',
    datasetId: '',
    priority: 0,
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [datasetsRes, mappingsRes, weeksRes] = await Promise.all([
        fetch('/api/lms/rag'),
        fetch('/api/lms/rag/mappings'),
        fetch('/api/lms/weeks'),
      ]);

      const datasetsData = await datasetsRes.json();
      const mappingsData = await mappingsRes.json();
      const weeksData = await weeksRes.json();

      if (datasetsData.success) {
        setDatasets(datasetsData.data.datasets);
      }
      if (mappingsData.success) {
        setMappings(mappingsData.data.mappings);
      }
      if (weeksData.success) {
        setWeeks(weeksData.data.weeks);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDataset = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);

    try {
      const res = await fetch('/api/lms/rag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(createForm),
      });

      const data = await res.json();
      if (data.success) {
        setShowCreateModal(false);
        setCreateForm({
          name: '',
          description: '',
          category: '',
          content: '',
          chunkSize: 500,
          overlap: 50,
        });
        fetchData();
      } else {
        alert(data.error?.message || '생성 실패');
      }
    } catch (error) {
      console.error('Create error:', error);
      alert('생성 중 오류 발생');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteDataset = async (datasetId: string) => {
    if (!confirm('이 데이터셋을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch('/api/lms/rag', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datasetId }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || '삭제 실패');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  const handleCreateMapping = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const res = await fetch('/api/lms/rag/mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mappingForm),
      });

      const data = await res.json();
      if (data.success) {
        setShowMappingModal(false);
        setMappingForm({ weekId: '', datasetId: '', priority: 0 });
        fetchData();
      } else {
        alert(data.error?.message || '매핑 생성 실패');
      }
    } catch (error) {
      console.error('Mapping create error:', error);
    }
  };

  const handleDeleteMapping = async (mappingId: string) => {
    if (!confirm('이 매핑을 삭제하시겠습니까?')) return;

    try {
      const res = await fetch('/api/lms/rag/mappings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappingId }),
      });

      const data = await res.json();
      if (data.success) {
        fetchData();
      } else {
        alert(data.error?.message || '삭제 실패');
      }
    } catch (error) {
      console.error('Mapping delete error:', error);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ready: 'bg-green-100 text-green-800',
      processing: 'bg-yellow-100 text-yellow-800',
      error: 'bg-red-100 text-red-800',
    };
    const labels: Record<string, string> = {
      ready: '준비됨',
      processing: '처리중',
      error: '오류',
    };
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || 'bg-gray-100'}`}>
        {labels[status] || status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">RAG 데이터셋 관리</h1>
        <p className="text-gray-600 mt-1">AI 피드백에 사용되는 참조 자료를 관리합니다</p>
      </div>

      {/* 탭 */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('datasets')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'datasets'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            데이터셋 ({datasets.length})
          </button>
          <button
            onClick={() => setActiveTab('mappings')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'mappings'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            주차 매핑 ({mappings.length})
          </button>
        </nav>
      </div>

      {/* 데이터셋 탭 */}
      {activeTab === 'datasets' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 새 데이터셋
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">카테고리</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">청크 수</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {datasets.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                      등록된 데이터셋이 없습니다
                    </td>
                  </tr>
                ) : (
                  datasets.map((dataset) => (
                    <tr key={dataset.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">{dataset.name}</div>
                        {dataset.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">{dataset.description}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {dataset.category || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {dataset.chunk_count}개
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(dataset.status)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {new Date(dataset.created_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteDataset(dataset.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 매핑 탭 */}
      {activeTab === 'mappings' && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setShowMappingModal(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
            >
              + 새 매핑
            </button>
          </div>

          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">코스</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">주차</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">데이터셋</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">우선순위</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">액션</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      등록된 매핑이 없습니다
                    </td>
                  </tr>
                ) : (
                  mappings.map((mapping) => (
                    <tr key={mapping.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {mapping.course_weeks?.courses?.title || '-'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {mapping.course_weeks?.week_number}주차
                        </div>
                        <div className="text-sm text-gray-500">
                          {mapping.course_weeks?.title}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900">
                          {mapping.rag_datasets?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {mapping.rag_datasets?.chunk_count}개 청크
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {mapping.priority}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleDeleteMapping(mapping.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium"
                        >
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* 데이터셋 생성 모달 */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">새 RAG 데이터셋 생성</h2>
            <form onSubmit={handleCreateDataset}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    데이터셋 이름 *
                  </label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    설명
                  </label>
                  <input
                    type="text"
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    카테고리
                  </label>
                  <input
                    type="text"
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    placeholder="예: sales_strategy, marketing_basics"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    텍스트 콘텐츠 *
                  </label>
                  <textarea
                    value={createForm.content}
                    onChange={(e) => setCreateForm({ ...createForm, content: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    rows={10}
                    required
                    placeholder="RAG에 사용할 참조 텍스트를 입력하세요..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      청크 크기 (문자)
                    </label>
                    <input
                      type="number"
                      value={createForm.chunkSize}
                      onChange={(e) => setCreateForm({ ...createForm, chunkSize: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      min={100}
                      max={2000}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      오버랩 (문자)
                    </label>
                    <input
                      type="number"
                      value={createForm.overlap}
                      onChange={(e) => setCreateForm({ ...createForm, overlap: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                      min={0}
                      max={500}
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? '생성 중...' : '생성'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 매핑 생성 모달 */}
      {showMappingModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">새 주차 매핑</h2>
            <form onSubmit={handleCreateMapping}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    주차 선택 *
                  </label>
                  <select
                    value={mappingForm.weekId}
                    onChange={(e) => setMappingForm({ ...mappingForm, weekId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">주차를 선택하세요</option>
                    {weeks.map((week) => (
                      <option key={week.id} value={week.id}>
                        [{week.courses?.title}] {week.week_number}주차 - {week.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    데이터셋 선택 *
                  </label>
                  <select
                    value={mappingForm.datasetId}
                    onChange={(e) => setMappingForm({ ...mappingForm, datasetId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    <option value="">데이터셋을 선택하세요</option>
                    {datasets
                      .filter((d) => d.status === 'ready')
                      .map((dataset) => (
                        <option key={dataset.id} value={dataset.id}>
                          {dataset.name} ({dataset.chunk_count}개 청크)
                        </option>
                      ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    우선순위
                  </label>
                  <input
                    type="number"
                    value={mappingForm.priority}
                    onChange={(e) => setMappingForm({ ...mappingForm, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                    min={0}
                  />
                  <p className="mt-1 text-xs text-gray-500">낮은 숫자가 높은 우선순위입니다</p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowMappingModal(false)}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  생성
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
