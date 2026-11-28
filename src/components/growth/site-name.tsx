// Only rendered on the homepage, where search engines look for a site name.
const siteName = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'MDView',
  alternateName: 'mdview.kr',
  url: 'https://www.mdview.kr/',
};

export function SiteName() {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(siteName) }} />;
}
