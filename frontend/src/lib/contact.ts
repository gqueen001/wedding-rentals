/** The site's "call us" number, published by the server in a <meta name="wr-contact-phone"> tag; null when not configured. */
export function contactPhone(doc: Pick<Document, "querySelector"> = document): string | null {
  const content = doc.querySelector<HTMLMetaElement>('meta[name="wr-contact-phone"]')?.content
    ?.trim();
  return content || null;
}
