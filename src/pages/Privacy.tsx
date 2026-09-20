import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose, ProseH2 } from "@/components/layout/Prose";
import { LEGAL_META } from "@/data/legal";

export default function PrivacyPage() {
  const meta = LEGAL_META.privacy;
  return (
    <LegalLayout title={meta.title} description={meta.description} keywords={meta.keywords}>
      <Prose>
        {meta.lastUpdated && <p className='text-lg text-muted-foreground'>Last updated: {meta.lastUpdated}</p>}

        <p>This policy explains what information RadioScout collects and how we use it.</p>

        <ProseH2>Information we collect</ProseH2>
        <p>
          RadioScout has no accounts and no servers. Your favourites, history, volume and votes stay in your browser's
          local storage on your own device — we never see, collect or transmit them.
        </p>

        <ProseH2>How we use your information</ProseH2>
        <ul className='list-inside list-disc space-y-2'>
          <li>Provide and operate the radio player on your device</li>
          <li>Remember your favourites, history and settings locally</li>
          <li>Fetch the public station directory (radio-browser.info) when you browse or search</li>
        </ul>

        <ProseH2>Data security</ProseH2>
        <p>
          We use administrative, technical and physical measures to protect your information. We take reasonable steps
          to keep it secure, but no system or transmission method can be guaranteed to be completely secure.
        </p>
      </Prose>
    </LegalLayout>
  );
}
