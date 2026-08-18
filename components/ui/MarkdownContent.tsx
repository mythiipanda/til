'use client';

import React, { memo } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownContentProps {
  content?: string | null | unknown;
  sources?: Array<{ id?: string; title?: string; url: string }>;
  className?: string;
}

function MarkdownContentImpl({ content, sources = [], className = '' }: MarkdownContentProps) {
  if (!content) return null;

  const textContent = typeof content === 'string' 
    ? content 
    : typeof content === 'object' 
    ? JSON.stringify(content) 
    : String(content);

  if (!textContent.trim()) return null;

  // Custom text renderer to parse [1], [2], etc. into interactive citation links
  const renderTextWithCitations = (text: string) => {
    if (!sources || sources.length === 0) return text;

    const parts = text.split(/(\[\d+\])/g);
    if (parts.length === 1) return text;

    return parts.map((part, idx) => {
      const match = part.match(/^\[(\d+)\]$/);
      if (match) {
        const num = parseInt(match[1], 10);
        const source = sources[num - 1];
        if (source && source.url) {
          return (
            <a
              key={idx}
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title || source.url}
              className="inline-flex items-center text-[10px] font-mono font-bold bg-neutral-100 hover:bg-black hover:text-white border border-neutral-300 hover:border-black px-1 py-0.2 mx-0.5 text-black transition-colors align-super no-underline select-none cursor-pointer"
            >
              [{num}]
            </a>
          );
        }
      }
      return part;
    });
  };

  try {
    return (
      <div className={`font-body text-inherit leading-relaxed ${className}`}>
        <ReactMarkdown
          components={{
            h1: ({ children }) => (
              <h1 className="font-serif text-xl md:text-2xl font-bold tracking-tight text-inherit my-3 border-b border-current pb-1">
                {children}
              </h1>
            ),
            h2: ({ children }) => (
              <h2 className="font-serif text-lg md:text-xl font-bold tracking-tight text-inherit my-2.5 border-b border-current/50 pb-0.5">
                {children}
              </h2>
            ),
            h3: ({ children }) => (
              <h3 className="font-serif text-base font-bold text-inherit my-2">
                {children}
              </h3>
            ),
            p: ({ children }) => (
              <p className="my-1.5 leading-relaxed text-inherit">
                {React.Children.map(children, child => {
                  if (typeof child === 'string') {
                    return renderTextWithCitations(child);
                  }
                  return child;
                })}
              </p>
            ),
            strong: ({ children }) => (
              <strong className="font-bold text-inherit underline decoration-1 underline-offset-2">
                {children}
              </strong>
            ),
            em: ({ children }) => (
              <em className="italic font-serif text-inherit">
                {children}
              </em>
            ),
            ul: ({ children }) => (
              <ul className="list-disc list-inside my-2 space-y-1 text-inherit pl-1">
                {children}
              </ul>
            ),
            ol: ({ children }) => (
              <ol className="list-decimal list-inside my-2 space-y-1 text-inherit pl-1 font-mono text-[11px]">
                {children}
              </ol>
            ),
            li: ({ children }) => (
              <li className="leading-relaxed">
                {React.Children.map(children, child => {
                  if (typeof child === 'string') {
                    return renderTextWithCitations(child);
                  }
                  return child;
                })}
              </li>
            ),
            blockquote: ({ children }) => (
              <blockquote className="border-l-2 border-current pl-3 my-2 italic text-inherit opacity-90">
                {children}
              </blockquote>
            ),
            code: ({ children }) => (
              <code className="font-mono text-xs px-1.5 py-0.5 border border-current/40 bg-current/5">
                {children}
              </code>
            ),
            pre: ({ children }) => (
              <pre className="font-mono text-xs p-3 my-2 border border-current/40 bg-current/5 overflow-x-auto">
                {children}
              </pre>
            ),
            a: ({ href, children }) => (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline decoration-1 underline-offset-2 text-inherit hover:opacity-75 font-semibold"
              >
                {children}
              </a>
            ),
          }}
        >
          {textContent}
        </ReactMarkdown>
      </div>
    );
  } catch (err) {
    console.error('MarkdownContent render error:', err);
    return <div className={`font-body text-inherit leading-relaxed ${className}`}>{textContent}</div>;
  }
}

export const MarkdownContent = memo(MarkdownContentImpl);
