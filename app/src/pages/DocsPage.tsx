import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import whatIsTheGoal from "../docs/what-is-the-goal.md?raw";
import howItWorks from "../docs/how-it-works.md?raw";
import gettingStarted from "../docs/getting-started.md?raw";
import contact from "../docs/contact.md?raw";

const sections = [whatIsTheGoal, howItWorks, gettingStarted, contact];

export default function DocsPage() {
  return (
    <div className="container">
      <h1>Docs</h1>
      <p className="page-sub">Everything you need to ship on kevred.</p>

      <article className="docs-prose">
        {sections.map((md, i) => (
          <ReactMarkdown key={i} remarkPlugins={[remarkGfm]}>
            {md}
          </ReactMarkdown>
        ))}
      </article>
    </div>
  );
}
