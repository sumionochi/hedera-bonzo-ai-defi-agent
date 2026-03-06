"use client";

import ReactMarkdown from "react-markdown";

/**
 * Renders agent messages as styled markdown.
 * Handles headers, bold, italic, lists, code blocks, tables.
 */
export default function MarkdownMessage({ content }: { content: string }) {
  return (
    <ReactMarkdown
      components={{
        // Headers
        h1: ({ children }) => (
          <h1 className="text-base font-bold text-emerald-400 mb-2 mt-3 first:mt-0">
            {children}
          </h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-sm font-bold text-emerald-400 mb-1.5 mt-3 first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-sm font-semibold text-emerald-300 mb-1 mt-2.5 first:mt-0">
            {children}
          </h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold text-gray-200 mb-1 mt-2">
            {children}
          </h4>
        ),

        // Paragraphs
        p: ({ children }) => (
          <p className="text-gray-300 mb-2 last:mb-0 leading-relaxed">
            {children}
          </p>
        ),

        // Bold
        strong: ({ children }) => (
          <strong className="font-semibold text-gray-100">{children}</strong>
        ),

        // Italic
        em: ({ children }) => (
          <em className="italic text-gray-200">{children}</em>
        ),

        // Links
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
          >
            {children}
          </a>
        ),

        // Inline code
        code: ({ className, children, ...props }) => {
          const isBlock = className?.includes("language-");
          if (isBlock) {
            return (
              <code
                className="block bg-gray-900/80 border border-gray-700/50 rounded-lg px-3 py-2 my-2 text-xs font-mono text-emerald-300 overflow-x-auto whitespace-pre"
                {...props}
              >
                {children}
              </code>
            );
          }
          return (
            <code
              className="bg-gray-700/50 text-emerald-300 px-1.5 py-0.5 rounded text-xs font-mono"
              {...props}
            >
              {children}
            </code>
          );
        },

        // Code blocks
        pre: ({ children }) => (
          <pre className="my-2">{children}</pre>
        ),

        // Unordered lists
        ul: ({ children }) => (
          <ul className="space-y-1 mb-2 ml-1">{children}</ul>
        ),

        // Ordered lists
        ol: ({ children }) => (
          <ol className="space-y-1 mb-2 ml-1 list-decimal list-inside">
            {children}
          </ol>
        ),

        // List items
        li: ({ children }) => (
          <li className="text-gray-300 flex gap-2 text-sm">
            <span className="text-emerald-500 mt-1 flex-shrink-0">•</span>
            <span className="flex-1">{children}</span>
          </li>
        ),

        // Tables
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-800/60 border-b border-gray-700/50">
            {children}
          </thead>
        ),
        tbody: ({ children }) => <tbody>{children}</tbody>,
        tr: ({ children }) => (
          <tr className="border-b border-gray-800/30">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="text-left px-2 py-1.5 text-gray-400 font-medium">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-2 py-1.5 text-gray-300">{children}</td>
        ),

        // Blockquotes
        blockquote: ({ children }) => (
          <blockquote className="border-l-2 border-emerald-500/40 pl-3 my-2 text-gray-400 italic">
            {children}
          </blockquote>
        ),

        // Horizontal rule
        hr: () => (
          <hr className="border-gray-700/50 my-3" />
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}