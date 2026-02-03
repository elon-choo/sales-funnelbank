// src/components/ui/markdown.tsx
'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ComponentPropsWithoutRef } from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  return (
    <div className={`markdown-body ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // 헤딩
        h1: ({ children, ...props }: ComponentPropsWithoutRef<'h1'>) => (
          <h1 className="text-xl font-bold text-white mt-4 mb-2 pb-2 border-b border-white/10" {...props}>
            {children}
          </h1>
        ),
        h2: ({ children, ...props }: ComponentPropsWithoutRef<'h2'>) => (
          <h2 className="text-lg font-bold text-white mt-4 mb-2" {...props}>
            {children}
          </h2>
        ),
        h3: ({ children, ...props }: ComponentPropsWithoutRef<'h3'>) => (
          <h3 className="text-base font-semibold text-white mt-3 mb-1" {...props}>
            {children}
          </h3>
        ),

        // 단락
        p: ({ children, ...props }: ComponentPropsWithoutRef<'p'>) => (
          <p className="text-gray-200 leading-relaxed mb-3 last:mb-0" {...props}>
            {children}
          </p>
        ),

        // 강조
        strong: ({ children, ...props }: ComponentPropsWithoutRef<'strong'>) => (
          <strong className="font-semibold text-white" {...props}>
            {children}
          </strong>
        ),
        em: ({ children, ...props }: ComponentPropsWithoutRef<'em'>) => (
          <em className="italic text-purple-300" {...props}>
            {children}
          </em>
        ),

        // 리스트
        ul: ({ children, ...props }: ComponentPropsWithoutRef<'ul'>) => (
          <ul className="list-disc list-inside space-y-1 mb-3 text-gray-200 ml-2" {...props}>
            {children}
          </ul>
        ),
        ol: ({ children, ...props }: ComponentPropsWithoutRef<'ol'>) => (
          <ol className="list-decimal list-inside space-y-1 mb-3 text-gray-200 ml-2" {...props}>
            {children}
          </ol>
        ),
        li: ({ children, ...props }: ComponentPropsWithoutRef<'li'>) => (
          <li className="text-gray-200 leading-relaxed" {...props}>
            {children}
          </li>
        ),

        // 코드
        code: ({ className, children, ...props }: ComponentPropsWithoutRef<'code'> & { inline?: boolean }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code
                className="bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded text-sm font-mono"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code className={`${className} block`} {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children, ...props }: ComponentPropsWithoutRef<'pre'>) => (
          <pre
            className="bg-black/40 border border-white/10 rounded-lg p-4 overflow-x-auto mb-3 text-sm"
            {...props}
          >
            {children}
          </pre>
        ),

        // 인용
        blockquote: ({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
          <blockquote
            className="border-l-4 border-purple-500 pl-4 py-1 my-3 bg-purple-500/10 rounded-r-lg italic text-gray-300"
            {...props}
          >
            {children}
          </blockquote>
        ),

        // 링크
        a: ({ children, href, ...props }: ComponentPropsWithoutRef<'a'>) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
            {...props}
          >
            {children}
          </a>
        ),

        // 수평선
        hr: (props: ComponentPropsWithoutRef<'hr'>) => (
          <hr className="border-white/10 my-4" {...props} />
        ),

        // 테이블
        table: ({ children, ...props }: ComponentPropsWithoutRef<'table'>) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full border border-white/10 rounded-lg overflow-hidden" {...props}>
              {children}
            </table>
          </div>
        ),
        thead: ({ children, ...props }: ComponentPropsWithoutRef<'thead'>) => (
          <thead className="bg-white/5" {...props}>
            {children}
          </thead>
        ),
        th: ({ children, ...props }: ComponentPropsWithoutRef<'th'>) => (
          <th className="px-4 py-2 text-left text-sm font-semibold text-white border-b border-white/10" {...props}>
            {children}
          </th>
        ),
        td: ({ children, ...props }: ComponentPropsWithoutRef<'td'>) => (
          <td className="px-4 py-2 text-sm text-gray-200 border-b border-white/5" {...props}>
            {children}
          </td>
        ),

        // 체크박스 (GFM)
        input: (props: ComponentPropsWithoutRef<'input'>) => {
          if (props.type === 'checkbox') {
            return (
              <input
                {...props}
                disabled
                className="mr-2 accent-purple-500"
              />
            );
          }
          return <input {...props} />;
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
}
