// Fills in index.html for a build: the version in the asset addresses and the address the site is served from.

/** Where the upstream copy lives. A build with no address of its own still points the link preview image here. */
export const UPSTREAM = 'https://arthur031221.github.io/Rumbleback/';

/**
 * `siteUrl` is the address the built site will be served from, such as the GitHub Pages address of a fork.
 * Without one the canonical link and `og:url` are left out, since claiming the upstream address as canonical
 * would tell search engines that a copy somewhere else is a duplicate.
 */
export function fillIndex(html, { version, siteUrl = '' }) {
  let out = html.replaceAll('__VERSION__', version);
  const site = siteUrl ? siteUrl.replace(/\/?$/, '/') : '';
  if (!site) out = out.replace(/<link rel="canonical"[^>]*>\s*/, '').replace(/<meta\s+property="og:url"[^>]*>\s*/, '');
  return out.replaceAll('__SITE_URL__', site || UPSTREAM);
}
