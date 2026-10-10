export type KnowledgeBlock = {kind: 'paragraph' | 'bullet' | 'step'; text: string};
export type KnowledgeArticle = {id: string; title: string; summary: string; permissions: string[]; global?: boolean; sections: {heading: string; blocks: KnowledgeBlock[]}[]; related: string[]};
export type KnowledgeBook = {id: string; title: string; description: string; environment: 'personal' | 'club' | 'platform'; articles: KnowledgeArticle[]};
export type KnowledgeContext = {environment: KnowledgeBook['environment']; member?: boolean; permissions: {key: string; global?: boolean}[]};
export function article(id: string, title: string, summary: string, permissions: string[], body: string, related?: string[]): KnowledgeArticle;
export function canReadArticle(context: KnowledgeContext, book: KnowledgeBook, entry: KnowledgeArticle): boolean;
export function readableBooks(books: KnowledgeBook[], context: KnowledgeContext): KnowledgeBook[];
export function searchKnowledge(books: KnowledgeBook[], context: KnowledgeContext, query?: string, bookId?: string): {bookId: string; bookTitle: string; entry: KnowledgeArticle; score: number}[];
