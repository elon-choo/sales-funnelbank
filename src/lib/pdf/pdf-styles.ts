// src/lib/pdf/pdf-styles.ts
// PDF 스타일 정의
import { StyleSheet } from '@react-pdf/renderer';

export const styles = StyleSheet.create({
  page: {
    fontFamily: 'NotoSansKR',
    fontSize: 10,
    padding: 40,
    lineHeight: 1.6,
    color: '#1a1a2e',
  },
  // 헤더
  header: {
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#a855f7',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 700,
    color: '#a855f7',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 2,
  },
  // 점수 박스
  scoreBox: {
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
  },
  scoreLabel: {
    fontSize: 14,
    color: '#7c3aed',
    marginRight: 8,
  },
  scoreValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#7c3aed',
  },
  scoreMax: {
    fontSize: 14,
    color: '#9ca3af',
  },
  // Heading
  h1: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
    marginTop: 16,
    color: '#1a1a2e',
    borderBottomWidth: 2,
    borderBottomColor: '#1a1a2e',
    paddingBottom: 4,
  },
  h2: {
    fontSize: 16,
    fontWeight: 700,
    marginBottom: 8,
    marginTop: 14,
    color: '#16213e',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 3,
  },
  h3: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 6,
    marginTop: 10,
    color: '#0f3460',
  },
  h4: {
    fontSize: 11,
    fontWeight: 700,
    marginBottom: 4,
    marginTop: 8,
    color: '#533483',
  },
  paragraph: {
    fontSize: 10,
    marginBottom: 4,
    lineHeight: 1.6,
  },
  bold: {
    fontWeight: 700,
  },
  italic: {
    fontStyle: 'italic',
  },
  // 리스트
  bulletItem: {
    flexDirection: 'row',
    marginBottom: 3,
    paddingLeft: 10,
  },
  bulletDot: {
    width: 15,
    fontSize: 10,
  },
  bulletText: {
    flex: 1,
    fontSize: 10,
    lineHeight: 1.5,
  },
  // 코드 블록
  codeBlock: {
    backgroundColor: '#f5f5f5',
    padding: 8,
    marginVertical: 4,
    fontSize: 9,
    fontFamily: 'NotoSansKR',
    borderRadius: 3,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  inlineCode: {
    backgroundColor: '#f5f5f5',
    fontSize: 9,
    color: '#e74c3c',
    padding: '1 3',
  },
  // 구분선
  hr: {
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
    marginVertical: 10,
  },
  // 인용문
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: '#533483',
    paddingLeft: 10,
    marginVertical: 6,
    color: '#555555',
    fontStyle: 'italic',
  },
  // 테이블
  table: {
    marginVertical: 6,
    borderWidth: 1,
    borderColor: '#dddddd',
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#dddddd',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 2,
    borderBottomColor: '#999999',
  },
  tableCell: {
    flex: 1,
    padding: 4,
    fontSize: 9,
  },
  tableCellHeader: {
    flex: 1,
    padding: 4,
    fontSize: 9,
    fontWeight: 700,
  },
  // 푸터
  footer: {
    position: 'absolute',
    bottom: 24,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#9ca3af',
    textAlign: 'center',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 8,
  },
});
