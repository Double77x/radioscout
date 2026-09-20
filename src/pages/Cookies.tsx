import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose, ProseH2 } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function CookiesPage() {
  const meta = LEGAL_META.cookies;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        {meta.lastUpdated && <p className='text-lg text-muted-foreground'>Last updated: {meta.lastUpdated}</p>}

        <p>
          This policy explains how RadioScout uses cookies and similar technologies to recognise you when you visit our
          website.
        </p>

        <ProseH2>What are cookies?</ProseH2>
        <p>
          Cookies are small files placed on your computer or mobile device when you visit a website. They help sites
          work, work more efficiently and provide reporting information.
        </p>

        <ProseH2>Why do we use cookies?</ProseH2>
        <p>
          Some cookies are essential for the website to operate. We call these "strictly necessary" cookies. Others help
          us understand how people use the site so we can improve it.
        </p>

        <ProseH2>How can I control cookies?</ProseH2>
        <p>
          You can choose to accept or reject cookies. This site uses only essential cookies needed for the website to
          function.
        </p>
      </Prose>
    </LegalLayout>
  );
}
