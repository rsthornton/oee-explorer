/** A section's name and one sentence on what it is for: the same opening on every page. */
export function PageHead({ title, lead }: { title: string; lead: string }) {
  return (
    <header className="page-head">
      <h1 className="page-title">{title}</h1>
      <p className="page-lead">{lead}</p>
    </header>
  );
}
