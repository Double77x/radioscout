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
          work, run more efficiently and provide reporting information.
        </p>

        <ProseH2>Why do we use cookies?</ProseH2>
        <p>
          We do not use tracking cookies, and we do not build a profile of you. Your saved stations, listening history
          and preferences are kept in your own device&apos;s storage (IndexedDB) rather than in cookies, so clearing
          site data erases them and nothing is sent to us.
        </p>

        <ProseH2>Station artwork</ProseH2>
        <p>
          Each station hosts its own logo on its own website. Loading those logos directly would hand every broadcaster
          your browser&apos;s ability to store a cookie on their site, and roughly half of them take that up. Instead,
          every logo is requested through a third-party image proxy that fetches it on our behalf and returns only the
          image, so no station can read or write a cookie for you. Those proxies do see that you asked for a given
          station&apos;s artwork; their own privacy policies describe how long they keep anything.
        </p>

        <ProseH2>How can I control cookies?</ProseH2>
        <p>
          There is nothing here to accept or reject — we set no cookies of our own, and the station artwork that used to
          create them is proxied. If a cookie for one of our proxy providers does appear in your browser, you can remove
          it with your browser&apos;s site-data controls.
        </p>
      </Prose>
    </LegalLayout>
  );
}
