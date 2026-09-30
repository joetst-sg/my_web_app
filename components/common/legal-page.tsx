import { PageHeader } from './basics'

export function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: [string, string][] }) {
  return (
    <div className="container-page max-w-3xl py-12">
      <PageHeader eyebrow="Legal" title={title} description={`Last updated ${updated}.`} />
      <p className="mt-8 rounded-xl bg-surface p-4 text-sm text-muted-foreground">
        This is a starting template written for the development build. Have it reviewed by a lawyer for your jurisdiction before launch.
      </p>
      <div className="mt-8 flex flex-col gap-8">
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-display text-xl font-bold">{heading}</h2>
            <p className="mt-2 leading-relaxed text-foreground/90">{body}</p>
          </section>
        ))}
      </div>
    </div>
  )
}
