interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  keywords?: string[];
  canonical?: string;
  type?: string;
  // New: specific schema for the page
  schema?: Record<string, unknown>;
  // New: data for BreadcrumbList schema
  breadcrumbItems?: { label: string; href: string }[];
}

import { siteConfig } from "@/lib/site";

const DEFAULT_KEYWORDS = [
  "home inventory",
  "home knowledge base",
  "appliances",
  "manuals",
  "warranties",
  "tools",
  "smart home",
  "pwa",
];

export const SEO = ({
  title = "Scout — your home, mapped",
  description = "Scout is your home knowledge base — every room, appliance, tool and system, mapped, searchable and always to hand.",
  image = "/web-app-manifest-512x512.png",
  url = siteConfig.url,
  keywords = DEFAULT_KEYWORDS,
  canonical,
  type = "website",
  schema,
  breadcrumbItems,
}: SEOProps) => {
  const fullTitle = title.includes(siteConfig.name) ? title : `${title} | ${siteConfig.name}`;
  const canonicalUrl = canonical || url;
  const siteUrl = siteConfig.url;

  const baseSchema: Record<string, unknown>[] = [
    {
      "@type": "SoftwareApplication",
      name: siteConfig.name,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
      description: siteConfig.description,
      url: siteUrl,
      image: `${siteUrl}${image}`,
      author: {
        "@type": "Person",
        name: "Double77x",
      },
    },
    {
      "@type": "WebSite",
      url: siteUrl,
      name: siteConfig.name,
      description: siteConfig.description,
      publisher: {
        "@type": "Person",
        name: "Double77x",
      },
    },
  ];

  if (schema) {
    baseSchema.push(schema);
  }

  if (breadcrumbItems && breadcrumbItems.length > 0) {
    baseSchema.push({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: breadcrumbItems.map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: item.href.startsWith("http") ? item.href : `${siteUrl}${item.href}`,
      })),
    });
  }

  return (
    <>
      {/* Basic Metadata */}
      <title>{fullTitle}</title>
      <meta name='description' content={description} />
      <meta name='keywords' content={keywords.join(", ")} />
      <meta name='author' content='Double77x' />
      <link rel='canonical' href={canonicalUrl} />

      {/* Social / Open Graph */}
      <meta property='og:type' content={type} />
      <meta property='og:url' content={canonicalUrl} />
      <meta property='og:title' content={fullTitle} />
      <meta property='og:description' content={description} />
      <meta property='og:image' content={`${siteUrl}${image}`} />
      <meta property='og:site_name' content={siteConfig.name} />
      <meta property='og:locale' content='en_GB' />

      {/* Twitter */}
      <meta name='twitter:card' content='summary_large_image' />
      <meta name='twitter:title' content={fullTitle} />
      <meta name='twitter:description' content={description} />
      <meta name='twitter:image' content={`${siteUrl}${image}`} />
      <meta name='twitter:creator' content='' />

      {/* PWA / Mobile */}
      <meta name='mobile-web-app-capable' content='yes' />
      <meta name='apple-mobile-web-app-capable' content='yes' />
      <meta name='apple-mobile-web-app-status-bar-style' content='default' />
      <meta name='apple-mobile-web-app-title' content={siteConfig.name} />
      <meta name='format-detection' content='telephone=no' />

      {/* JSON-LD Structured Data */}
      <script type='application/ld+json'>
        {JSON.stringify({
          "@context": "https://schema.org",
          "@graph": baseSchema,
        })}
      </script>
    </>
  );
};
