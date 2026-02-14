// src/lib/pdf/md-to-pdf.tsx
// Markdown → PDF 변환 (React PDF Document)
// 대용량 문서(30K+ chars)를 섹션별 멀티페이지로 분할 렌더링
import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
  renderToBuffer,
} from '@react-pdf/renderer';
import { registerFontsAsync } from './register-fonts';
import { styles } from './pdf-styles';
import { parseMd, type MdNode, type InlineNode, type ListItemNode } from './md-parser';

// ─── 인라인 노드 렌더링 ───

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
  return (
    <Text>
      {nodes.map((node, i) => {
        switch (node.type) {
          case 'bold':
            return (
              <Text key={i} style={styles.bold}>
                {node.text}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} style={styles.italic}>
                {node.text}
              </Text>
            );
          case 'codespan':
            return (
              <Text key={i} style={styles.inlineCode}>
                {node.text}
              </Text>
            );
          case 'link':
            return (
              <Text key={i} style={{ color: '#2563eb' }}>
                {node.text}
              </Text>
            );
          case 'text':
          default:
            return <Text key={i}>{node.text}</Text>;
        }
      })}
    </Text>
  );
}

// ─── 블록 노드 렌더링 ───

function MdBlock({ node }: { node: MdNode }) {
  switch (node.type) {
    case 'heading': {
      const headingStyle =
        node.depth === 1
          ? styles.h1
          : node.depth === 2
            ? styles.h2
            : node.depth === 3
              ? styles.h3
              : styles.h4;
      return (
        <View style={headingStyle} wrap={false}>
          <InlineContent nodes={node.children} />
        </View>
      );
    }

    case 'paragraph':
      return (
        <View style={styles.paragraph}>
          <InlineContent nodes={node.children} />
        </View>
      );

    case 'list':
      return (
        <View>
          {node.items.map((item: ListItemNode, i: number) => (
            <View key={i} style={styles.bulletItem} wrap={false}>
              <Text style={styles.bulletDot}>
                {node.ordered ? `${i + 1}.` : '\u2022'}
              </Text>
              <View style={styles.bulletText}>
                <InlineContent nodes={item.children} />
              </View>
            </View>
          ))}
        </View>
      );

    case 'code':
      return (
        <View style={styles.codeBlock}>
          <Text>{node.text}</Text>
        </View>
      );

    case 'blockquote':
      return (
        <View style={styles.blockquote}>
          {node.children.map((child, i) => (
            <MdBlock key={i} node={child} />
          ))}
        </View>
      );

    case 'hr':
      return <View style={styles.hr} />;

    case 'table':
      return (
        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            {node.header.map((cell, i) => (
              <Text key={i} style={styles.tableCellHeader}>
                {cell}
              </Text>
            ))}
          </View>
          {node.rows.map((row, ri) => (
            <View key={ri} style={styles.tableRow}>
              {row.map((cell, ci) => (
                <Text key={ci} style={styles.tableCell}>
                  {cell}
                </Text>
              ))}
            </View>
          ))}
        </View>
      );

    case 'space':
      return <View style={{ height: 4 }} />;

    default:
      return null;
  }
}

// ─── 노드 그룹을 섹션으로 분할 (H1/H2 기준) ───

function splitIntoSections(nodes: MdNode[]): MdNode[][] {
  const sections: MdNode[][] = [];
  let current: MdNode[] = [];

  for (const node of nodes) {
    // H1 또는 H2에서 새 섹션 시작 (첫 번째가 아닌 경우)
    if (
      node.type === 'heading' &&
      (node.depth === 1 || node.depth === 2) &&
      current.length > 0
    ) {
      sections.push(current);
      current = [];
    }
    current.push(node);
  }

  if (current.length > 0) {
    sections.push(current);
  }

  // 섹션이 너무 큰 경우 (~50 노드 이상) 추가 분할
  const MAX_NODES_PER_SECTION = 50;
  const finalSections: MdNode[][] = [];

  for (const section of sections) {
    if (section.length <= MAX_NODES_PER_SECTION) {
      finalSections.push(section);
    } else {
      // 큰 섹션을 MAX_NODES_PER_SECTION 단위로 분할
      for (let i = 0; i < section.length; i += MAX_NODES_PER_SECTION) {
        finalSections.push(section.slice(i, i + MAX_NODES_PER_SECTION));
      }
    }
  }

  return finalSections;
}

// ─── 피드백 PDF 문서 컴포넌트 (멀티페이지) ───

interface FeedbackPdfProps {
  markdown: string;
  title?: string;
  subtitle?: string;
  score?: number | null;
  createdAt?: string;
}

export function FeedbackPdfDocument({
  markdown,
  title,
  subtitle,
  score,
  createdAt,
}: FeedbackPdfProps) {
  const nodes = parseMd(markdown);
  const sections = splitIntoSections(nodes);

  const footerRender = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
    `마그네틱 세일즈 마스터클래스 | AI 피드백 리포트 | ${pageNumber} / ${totalPages}`;

  return (
    <Document>
      {/* 첫 번째 페이지: 헤더 + 점수 + 첫 번째 섹션 */}
      <Page size="A4" style={styles.page}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{title || 'AI 피드백 리포트'}</Text>
          {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
          {createdAt && (
            <Text style={styles.headerSubtitle}>
              생성일: {new Date(createdAt).toLocaleString('ko-KR')}
            </Text>
          )}
        </View>

        {/* 점수 */}
        {score !== null && score !== undefined && (
          <View style={styles.scoreBox}>
            <Text style={styles.scoreLabel}>총점</Text>
            <Text style={styles.scoreValue}>{score}</Text>
            <Text style={styles.scoreMax}> / 100</Text>
          </View>
        )}

        {/* 첫 번째 섹션 */}
        {sections[0]?.map((node, i) => (
          <MdBlock key={i} node={node} />
        ))}

        <Text style={styles.footer} render={footerRender} fixed />
      </Page>

      {/* 나머지 섹션: 각각 별도 페이지 */}
      {sections.slice(1).map((section, si) => (
        <Page key={si} size="A4" style={styles.page}>
          {section.map((node, ni) => (
            <MdBlock key={ni} node={node} />
          ))}
          <Text style={styles.footer} render={footerRender} fixed />
        </Page>
      ))}
    </Document>
  );
}

// ─── 메인 변환 함수 ───

/**
 * Markdown 문자열을 PDF Buffer로 변환
 */
export async function mdToPdf(markdown: string): Promise<Buffer> {
  await registerFontsAsync();
  const nodes = parseMd(markdown);
  const sections = splitIntoSections(nodes);

  const footerRender = ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
    `마그네틱 세일즈 마스터클래스 | AI 피드백 리포트 | ${pageNumber} / ${totalPages}`;

  const buffer = await renderToBuffer(
    <Document>
      {sections.map((section, si) => (
        <Page key={si} size="A4" style={styles.page}>
          {section.map((node, ni) => (
            <MdBlock key={ni} node={node} />
          ))}
          <Text style={styles.footer} render={footerRender} fixed />
        </Page>
      ))}
    </Document>
  );
  return Buffer.from(buffer);
}
