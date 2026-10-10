// Plain text only: author content never becomes executable HTML or Markdown.
export function article(id, title, summary, permissions, body, related = []) {
  const sections = body.trim().split(/^## /m).filter(Boolean).map((block) => {
    const [heading, ...lines] = block.trim().split('\n');
    return {heading, blocks: lines.map(line => line.trim()).filter(Boolean).map(line => {
      if (/^\d+\. /.test(line)) return {kind: 'step', text: line.replace(/^\d+\. /, '')};
      if (line.startsWith('- ')) return {kind: 'bullet', text: line.slice(2)};
      return {kind: 'paragraph', text: line};
    })};
  });
  return {id, title, summary, permissions, sections, related};
}

export function canReadArticle(context, book, entry) {
  if (book.environment !== context.environment) return false;
  if (book.environment === 'personal') return context.member === true;
  return entry.permissions.some(key => context.permissions.some(permission =>
    permission.key === key && (!entry.global || permission.global === true)));
}

const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl-NL').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function readableBooks(books, context) {
  return books.map(book => ({...book, articles: book.articles.filter(entry => canReadArticle(context, book, entry))})).filter(book => book.articles.length > 0);
}
export function searchKnowledge(books, context, query = '', bookId = '') {
  const terms = normalize(String(query).slice(0, 180)).split(' ').filter(Boolean).slice(0, 12);
  return readableBooks(books, context).filter(book => !bookId || book.id === bookId).flatMap(book => book.articles.flatMap(entry => {
    const title = normalize(entry.title), summary = normalize(entry.summary);
    const body = normalize(entry.sections.flatMap(section => [section.heading, ...section.blocks.map(block => block.text)]).join(' '));
    if (!terms.every(term => title.includes(term) || summary.includes(term) || body.includes(term))) return [];
    const score = terms.reduce((total, term) => total + (title.includes(term) ? 8 : summary.includes(term) ? 3 : 1), 0);
    return [{bookId: book.id, bookTitle: book.title, entry, score}];
  })).sort((a, b) => b.score - a.score || a.entry.title.localeCompare(b.entry.title, 'nl'));
}
