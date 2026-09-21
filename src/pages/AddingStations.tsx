import { LegalLayout } from "@/components/layout/LegalLayout";
import { Prose, ProseH2 } from "@/components/layout/Prose";

const ADD_STATION_URL = "https://www.radio-browser.info/add";
const DIRECTORY_URL = "https://www.radio-browser.info";

/**
 * Guide: where RadioScout stations come from and how to add a missing one.
 * RadioScout hosts no streams — radio-browser.info is the source of truth,
 * so additions happen there, not in the app.
 */
export default function AddingStationsPage() {
  return (
    <LegalLayout
      title='Adding stations'
      description='RadioScout plays the radio-browser.info directory. Add a missing station there and it shows up here.'
      keywords={["add station", "radio-browser.info", "submit station", "station directory", "missing station"]}>
      <Prose>
        <ProseH2>Where stations come from</ProseH2>
        <p>
          RadioScout doesn&apos;t host any audio and keeps no station catalogue of its own. Every station you see in
          search results, Most loved and the genre chips comes from{" "}
          <a
            href={DIRECTORY_URL}
            target='_blank'
            rel='noreferrer'
            className='text-primary underline-offset-4 hover:underline'>
            radio-browser.info
          </a>
          , the free community-run directory of internet radio. It is the source of truth: add a station there once and
          it becomes available in RadioScout and every other app built on the directory.
        </p>
        <p>
          That also means stations can&apos;t be added from inside RadioScout. There are no accounts here, and the
          directory handles submissions and stream checks centrally.
        </p>

        <ProseH2>Before you add</ProseH2>
        <p>Have these ready. They decide whether the listing works in the app:</p>
        <ul className='list-inside list-disc space-y-2'>
          <li>
            The direct stream URL (an MP3, AAC, OGG or HLS `.m3u8` stream), not the station&apos;s website or web player
            page.
          </li>
          <li>
            Prefer an <code>https://</code> stream. Plain <code>http://</code> streams are blocked on secure pages and
            in the Android app, so they won&apos;t play in RadioScout.
          </li>
          <li>The station name, plus anything else you know: homepage, country, language, genre tags.</li>
        </ul>

        <ProseH2>Add it in three steps</ProseH2>
        <ol className='list-inside list-decimal space-y-2'>
          <li>
            Open{" "}
            <a
              href={ADD_STATION_URL}
              target='_blank'
              rel='noreferrer'
              className='text-primary underline-offset-4 hover:underline'>
              radio-browser.info/add
            </a>{" "}
            and fill in the form.
          </li>
          <li>Submit. The directory automatically checks that the stream actually plays.</li>
          <li>
            Wait for the listing to go live, then search the station name in RadioScout. If it doesn&apos;t appear yet,
            give the directory mirrors a little time to sync and try again.
          </li>
        </ol>

        <ProseH2>After it&apos;s listed</ProseH2>
        <p>
          Votes and listening counts start from zero like any new station. Play it, vote for it in the station details,
          and save it to your favourites. If a stream later goes offline, the directory&apos;s automatic checks flag it,
          and RadioScout will say so instead of spinning silently.
        </p>
      </Prose>
    </LegalLayout>
  );
}
