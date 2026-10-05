// Puts light-markdown structure back on its own lines when a writer (or the
// AI) ran it into one paragraph: "… text. ### Key features • A • B" →
// paragraph, blank line, "### Key features", blank line, one "• " line each.
// Plain module: used when saving AI text and when rendering descriptions.
export function tidyStructure(text: string) {
  return text
    .replace(/\r\n/g, '\n')
    // A heading marker in the middle of a line starts a new block.
    .replace(/([^\n#])[ \t]*(#{2,6}[ \t]+)/g, '$1\n\n$2')
    // A bullet in the middle of a line starts a new line.
    .replace(/([^\n])[ \t]+([•・])[ \t]+/g, '$1\n$2 ')
    // Headings stand alone (blank line after them).
    .replace(/^(#{1,6}[ \t]+[^\n]+)\n(?!\n)/gm, '$1\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
