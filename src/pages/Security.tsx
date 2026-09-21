import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose, ProseH2 } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function SecurityPage() {
  const meta = LEGAL_META.security;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        <p className='text-lg text-muted-foreground'>RadioScout has no accounts and no servers holding your data.</p>

        <ProseH2>Static-first delivery</ProseH2>
        <p>
          RadioScout ships as prerendered static pages. There is no account database to breach. Your favourites and
          history stay on your device unless you choose to share a backup file.
        </p>

        <ProseH2>Infrastructure security</ProseH2>
        <p>
          The site is hosted with an established cloud provider, and data in transit between your device and our
          services uses TLS encryption.
        </p>

        <ProseH2>Data privacy</ProseH2>
        <p>We do not sell your data to third parties. See our Privacy Policy for details.</p>

        <ProseH2>Reporting vulnerabilities</ProseH2>
        <p>
          If you find a security vulnerability, please{" "}
          <a href='https://github.com/Double77x/radioscout/security/advisories/new'>report it privately</a>. Thank you
          for helping us keep the platform secure.
        </p>
      </Prose>
    </LegalLayout>
  );
}
