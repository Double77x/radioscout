import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose, ProseH2 } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function SecurityPage() {
  const meta = LEGAL_META.security;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        <p className='text-lg text-muted-foreground'>We put the safety of your data first.</p>

        <ProseH2>Static-first delivery</ProseH2>
        <p>
          RadioScout ships as prerendered static pages. There is no account database to breach — your favourites and
          history stay on your device unless you choose to share a backup file.
        </p>

        <ProseH2>Infrastructure security</ProseH2>
        <p>
          We host on secure, industry-standard cloud providers and use TLS/SSL encryption for data in transit between
          your device and our services.
        </p>

        <ProseH2>Data privacy</ProseH2>
        <p>We do not sell your data to third parties. See our Privacy Policy for details.</p>

        <ProseH2>Reporting vulnerabilities</ProseH2>
        <p>
          If you find a security vulnerability, please email danreaduk@proton.me. Thank you for helping us keep the
          platform secure.
        </p>
      </Prose>
    </LegalLayout>
  );
}
