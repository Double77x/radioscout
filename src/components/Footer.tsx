import { Link } from "@tanstack/react-router";
import { version as appVersion } from "../../package.json";
import { Logo } from "@/components/Logo";
import { FOOTER_LEGAL_LINKS, FOOTER_PRODUCT_LINKS } from "@/data/navigation";
import { siteConfig } from "@/lib/site";

const Footer = () => {
  const year = new Date().getFullYear();

  return (
    <footer className='border-t border-border bg-surface-2'>
      <div className='mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8'>
        <div className='grid grid-cols-1 gap-10 lg:grid-cols-2'>
          {/* Brand */}
          <div>
            <Link to='/' className='mb-3 flex items-center gap-2'>
              <Logo className='size-7' />
              <span className='text-lg font-semibold tracking-tight text-foreground'>{siteConfig.name}</span>
            </Link>
            <p className='max-w-sm text-sm leading-relaxed text-muted-foreground'>
              Free worldwide radio — top stations, genre search, favourites and history. Station directory by{" "}
              <a
                href='https://www.radio-browser.info'
                target='_blank'
                rel='noreferrer'
                className='underline underline-offset-4 hover:text-foreground'>
                radio-browser.info
              </a>
              .
            </p>
            <div className='mt-5 flex gap-2'>
              <a
                href={siteConfig.links.github}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='GitHub'
                className='flex size-8 items-center justify-center rounded-md border-hairline bg-surface-1 text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground'>
                <svg className='size-4' fill='currentColor' viewBox='0 0 24 24' aria-hidden='true'>
                  <path
                    fillRule='evenodd'
                    d='M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z'
                    clipRule='evenodd'
                  />
                </svg>
              </a>
            </div>
          </div>

          {/* Links — driven from single source in data/navigation.ts */}
          <div className='grid grid-cols-2 gap-8 sm:grid-cols-2'>
            <div>
              <h3 className='mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase'>Product</h3>
              <ul className='space-y-2.5'>
                {FOOTER_PRODUCT_LINKS.map((link) => (
                  <li key={link.to + link.label}>
                    <Link
                      to={link.to}
                      className='text-sm text-muted-foreground transition-colors hover:text-foreground'>
                      {link.label}
                    </Link>
                  </li>
                ))}
                <li>
                  <a
                    href={siteConfig.links.releases}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-sm text-muted-foreground transition-colors hover:text-foreground'>
                    Android app
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className='mb-3 text-xs font-semibold tracking-widest text-muted-foreground uppercase'>Legal</h3>
              <ul className='space-y-2.5'>
                {FOOTER_LEGAL_LINKS.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className='text-sm text-muted-foreground transition-colors hover:text-foreground'>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className='mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between'>
          <p className='text-xs text-muted-foreground'>
            © {year} {siteConfig.name}. All rights reserved.
          </p>
          <p className='flex items-center gap-2 text-xs text-muted-foreground'>
            <span>v{appVersion}</span>
            <span aria-hidden='true'>·</span>
            <span>Built By ❤️ Dan</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
