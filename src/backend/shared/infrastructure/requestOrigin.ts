/** A fixed deployment origin handles TLS termination without trusting client proxy headers. */
export function requestOrigin(request: Request): string {
  const configured = process.env.PUBLIC_ORIGIN?.trim();
  if (configured) {
    const url = new URL(configured);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
      throw new Error('PUBLIC_ORIGIN must contain only the public http(s) origin');
    return url.origin;
  }
  const url = new URL(request.url);
  return `${url.protocol}//${request.headers.get('host') ?? url.host}`;
}
