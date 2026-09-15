import { memo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeSanitize from 'rehype-sanitize'

const remarkPlugins = [remarkGfm]
const rehypePlugins = [rehypeSanitize]

export const Markdown = memo(function Markdown({ children }: { children: string }) {
  return <div className="markdown"><ReactMarkdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} skipHtml>{children || '*Пустая заметка*'}</ReactMarkdown></div>
})
