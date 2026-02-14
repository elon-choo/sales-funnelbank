// src/lib/pdf/md-parser.ts
// Markdown → 구조화된 토큰 파싱 (marked 기반, 인라인 토큰 지원)
import { marked, type Token, type Tokens } from 'marked';

export type MdNode =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'list'; ordered: boolean; items: ListItemNode[] }
  | { type: 'code'; lang: string; text: string }
  | { type: 'blockquote'; children: MdNode[] }
  | { type: 'hr' }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'space' };

export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'italic'; text: string }
  | { type: 'codespan'; text: string }
  | { type: 'link'; href: string; text: string };

export type ListItemNode = {
  children: InlineNode[];
};

/**
 * 이모지 문자 제거 (NotoSansKR 폰트에 이모지 글리프 없음 → 깨짐 방지)
 * 주의: 줄바꿈/공백 구조는 절대 건드리지 않음 (마크다운 파싱에 필수)
 */
function stripEmoji(text: string): string {
  return text.replace(
    /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{E0020}-\u{E007F}\u{2702}-\u{27B0}\u{231A}-\u{231B}\u{23E9}-\u{23F3}\u{23F8}-\u{23FA}\u{25AA}-\u{25AB}\u{25B6}\u{25C0}\u{25FB}-\u{25FE}\u{2614}-\u{2615}\u{2648}-\u{2653}\u{267F}\u{2693}\u{26A1}\u{26AA}-\u{26AB}\u{26BD}-\u{26BE}\u{26C4}-\u{26C5}\u{26CE}\u{26D4}\u{26EA}\u{26F2}-\u{26F3}\u{26F5}\u{26FA}\u{26FD}\u{2934}-\u{2935}\u{2B05}-\u{2B07}\u{2B1B}-\u{2B1C}\u{2B50}\u{2B55}\u{3030}\u{303D}\u{3297}\u{3299}]/gu,
    ''
  );
}

/**
 * Markdown 텍스트를 구조화된 토큰 배열로 변환
 */
export function parseMd(markdown: string): MdNode[] {
  const cleaned = stripEmoji(markdown);
  const tokens = marked.lexer(cleaned);
  return tokens.map(tokenToNode).filter((n): n is MdNode => n !== null);
}

function tokenToNode(token: Token): MdNode | null {
  switch (token.type) {
    case 'heading':
      return {
        type: 'heading',
        depth: token.depth as 1 | 2 | 3 | 4 | 5 | 6,
        children: parseInline(token.tokens || []),
      };

    case 'paragraph':
      return {
        type: 'paragraph',
        children: parseInline(token.tokens || []),
      };

    case 'list':
      return {
        type: 'list',
        ordered: (token as Tokens.List).ordered,
        items: (token as Tokens.List).items.map((item: Tokens.ListItem) => ({
          children: parseInlineFromText(item.text),
        })),
      };

    case 'code':
      return {
        type: 'code',
        lang: (token as Tokens.Code).lang || '',
        text: (token as Tokens.Code).text,
      };

    case 'blockquote':
      return {
        type: 'blockquote',
        children: ((token as Tokens.Blockquote).tokens || [])
          .map(tokenToNode)
          .filter((n): n is MdNode => n !== null),
      };

    case 'hr':
      return { type: 'hr' };

    case 'table': {
      const tableToken = token as Tokens.Table;
      return {
        type: 'table',
        header: tableToken.header.map((cell: Tokens.TableCell) => getCellText(cell)),
        rows: tableToken.rows.map((row: Tokens.TableCell[]) =>
          row.map((cell: Tokens.TableCell) => getCellText(cell))
        ),
      };
    }

    case 'space':
      return { type: 'space' };

    default:
      if ('text' in token && typeof token.text === 'string') {
        return {
          type: 'paragraph',
          children: [{ type: 'text', text: token.text }],
        };
      }
      return null;
  }
}

function getCellText(cell: Tokens.TableCell): string {
  return cell.tokens
    .map((t: Token) => ('text' in t ? (t as { text: string }).text : ''))
    .join('');
}

function parseInline(tokens: Token[]): InlineNode[] {
  const result: InlineNode[] = [];
  for (const token of tokens) {
    switch (token.type) {
      case 'strong': {
        const strongToken = token as Tokens.Strong;
        result.push({
          type: 'bold',
          text: strongToken.tokens
            ? strongToken.tokens.map((t: Token) => ('text' in t ? (t as { text: string }).text : '')).join('')
            : strongToken.text,
        });
        break;
      }
      case 'em': {
        const emToken = token as Tokens.Em;
        result.push({
          type: 'italic',
          text: emToken.tokens
            ? emToken.tokens.map((t: Token) => ('text' in t ? (t as { text: string }).text : '')).join('')
            : emToken.text,
        });
        break;
      }
      case 'codespan':
        result.push({ type: 'codespan', text: (token as Tokens.Codespan).text });
        break;
      case 'link':
        result.push({ type: 'link', href: (token as Tokens.Link).href, text: (token as Tokens.Link).text });
        break;
      case 'text': {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          result.push(...parseInline(textToken.tokens));
        } else {
          result.push({ type: 'text', text: textToken.text });
        }
        break;
      }
      default:
        if ('text' in token && typeof token.text === 'string') {
          result.push({ type: 'text', text: token.text });
        }
    }
  }
  return result;
}

function parseInlineFromText(text: string): InlineNode[] {
  const tokens = marked.lexer(text);
  const inlineNodes: InlineNode[] = [];
  for (const token of tokens) {
    if (token.type === 'paragraph' && (token as Tokens.Paragraph).tokens) {
      inlineNodes.push(...parseInline((token as Tokens.Paragraph).tokens));
    } else if ('text' in token && typeof token.text === 'string') {
      inlineNodes.push({ type: 'text', text: token.text });
    }
  }
  return inlineNodes.length > 0 ? inlineNodes : [{ type: 'text', text }];
}
