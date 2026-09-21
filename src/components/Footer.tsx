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
                    d='M12 2C6.48 2 2 6.48 2 12.02c0 4.42 2.87 8.18 6.84 9.5.5.090.68-0.220.68-0.48 0-0.24-0.01-0.87-0.01-1.7-2.780.6-3.37-1.34-3.37-1.34-0.45-1.16-1.11-1.47-1.11-1.47-0.91-.62.07-0.610.07-0.61 1.07 1.53 1.03 1.53 1.030.89 1.53 2.34 1.09 2.91.830.09-0.65.35-1.090.64-1.34-2.22-0.25-4.55-1.11-4.55-4.95 0-1.09.39-1.99 1.03-2.69-0.1-0.25-0.45-1.270.1-2.65 0 0 .84-.27 2.75 1.03A9.56 9.56 0 0112 6.84c.85 1.710.12 2.50.34 1.91-1.3 2.75-1.03 2.75-1.030.55 1.380.2 2.4.1 2.65.64.7 1.03 1.59 1.03 2.69 0 3.85-2.34 4.7-4.57 4.940.360.310.68.92.68 1.85 0 1.34-0.01 2.42-0.01 2.75 0 0.27.18.58.690.48A10.02 10.02 0 0022 12.02C22 6.48 17.52 2 12 2z'
                    clipRule='evenodd'
                  />
                </svg>
              </a>
              <a
                href={siteConfig.links.releases}
                target='_blank'
                rel='noopener noreferrer'
                aria-label='Android app'
                className='flex size-8 items-center justify-center rounded-md border-hairline bg-surface-1 text-muted-foreground transition-colors hover:border-hairline-strong hover:text-foreground'>
                <svg className='size-4' fill='currentColor' viewBox='0 0 24 24' aria-hidden='true'>
                  <path d='M18.44 5.56c-0.68 1.17-1.35 2.33-2.03 3.5-0.04-0.02-0.07-0.03-0.11-0.04-1.82-0.7-3.48-.8-4.42-0.79-1.860.02-3.350.46-4.260.82-0.08-0.15-1.75-3.02-2.02-3.49a1.15 1.15 0 0 0-0.14-0.19c-0.33-0.36-0.91-0.49-1.38-0.2-0.470.28-0.710.94-0.39 1.5 1.95 3.37-0.1-0.22 1.95 3.360.020.03-0.490.26-1.39 1.02C2.9 12.180.45 14.77 0 18.99h24c-0.12-1.11-0.37-2.1-0.75-3.07-0.74-1.91-1.84-3.29-2.74-4.18a12.1 12.1 0 0 0-2.13-1.69c0.66-1.12 1.31-2.26 1.96-3.380.21-0.360.19-0.8-0.01-1.12a1.1 1.1 0 0 0-0.85-0.53c-0.52-0.05-0.940.31-1.050.54zm-0.04 8.46c0.390.590.32 1.33-0.16 1.65-0.480.32-1.190.1-1.58-0.49-0.39-0.59-0.32-1.330.16-1.650.47-0.32 1.18-0.11 1.580.49zM7.21 13.53c0.480.320.55 1.060.16 1.65-0.390.59-1.10.81-1.580.49-.48-0.32-0.55-1.06-0.16-1.650.4-0.6 1.11-0.81 1.58-0.49z' />
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
