import { Fragment } from 'react'

// Renders product descriptions written as plain text with light markdown:
// "### heading", "**bold**", "• " or "- " bullet lines, blank lines between
// paragraphs. Everything is rendered as text (never as HTML).
function inline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  )
}

export function RichText({ text, className }: { text: string; className?: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <div className={className}>
      {blocks.map((block, i) => {
        const heading = block.match(/^#{1,6}\s+(.+)$/)
        if (heading && !block.includes('\n')) return <h3 key={i} className="mt-2 font-sans text-lg font-semibold tracking-normal">{inline(heading[1].replace(/^\*\*(.*)\*\*$/, '$1'))}</h3>
        const lines = block.split('\n')
        const bullet = /^\s*(?:[•・\-*])\s+/
        if (lines.length > 1 && lines.slice(lines[0].match(bullet) ? 0 : 1).every((l) => bullet.test(l))) {
          const lead = lines[0].match(bullet) ? null : lines[0]
          return (
            <Fragment key={i}>
              {lead && <p>{inline(lead)}</p>}
              <ul className="list-disc space-y-1 pl-5">{lines.filter((l) => bullet.test(l)).map((l, j) => <li key={j}>{inline(l.replace(bullet, ''))}</li>)}</ul>
            </Fragment>
          )
        }
        if (lines.length === 1 && bullet.test(block)) return <ul key={i} className="list-disc pl-5"><li>{inline(block.replace(bullet, ''))}</li></ul>
        return (
          <p key={i}>
            {lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </Fragment>
            ))}
          </p>
        )
      })}
    </div>
  )
}
