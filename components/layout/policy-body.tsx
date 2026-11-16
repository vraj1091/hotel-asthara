/** Renders admin-edited policy text safely as plain text: blank line = new paragraph, lines starting "- " = bullet list. */
export function PolicyBody({ body }: { body: string }) {
  const blocks = body
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  return (
    <div className="grid max-w-[68ch] gap-5 text-lg leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((l) => l.startsWith("- "))) {
          return (
            <ul key={i} className="[&>li]:marker:text-accent grid gap-2 pl-5 [&>li]:list-disc">
              {lines.map((l) => (
                <li key={l}>{l.slice(2)}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block}</p>;
      })}
    </div>
  );
}
