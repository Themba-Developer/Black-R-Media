// Keep the original Pages project, its assets and backend bindings intact.
const origin = 'https://black-r-website.pages.dev';
export default {
  async fetch(request) {
    const incoming = new URL(request.url);
    const upstream = new URL(incoming.pathname + incoming.search, origin);
    const headers = new Headers(request.headers);
    // Translate same-origin browser headers only; foreign origins remain foreign.
    if (headers.get('Origin') === incoming.origin) headers.set('Origin', origin);
    const referer = headers.get('Referer');
    if (referer && new URL(referer).origin === incoming.origin) {
      const translated = new URL(referer);
      translated.protocol = 'https:';
      translated.host = new URL(origin).host;
      headers.set('Referer', translated.href);
    }
    const response = await fetch(new Request(upstream, new Request(request, { headers, redirect: 'manual' })));
    const result = new Response(response.body, response);
    const location = result.headers.get('Location');
    if (location) {
      const target = new URL(location, upstream);
      if (target.origin === origin) result.headers.set('Location', incoming.origin + target.pathname + target.search + target.hash);
    }
    if (result.headers.get('Content-Type')?.includes('text/html')) {
      return new HTMLRewriter().on('title', {
        element(element) { element.setInnerContent('Black R Clothing'); }
      }).on('a.brand', {
        element(element) { element.setAttribute('aria-label', 'Black R Clothing home'); }
      }).transform(result);
    }
    return result;
  }
};
