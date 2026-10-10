import 'server-only';
import Link from 'next/link';
import {BookOpen, ArrowLeft, ArrowRight, Search, ListChecks} from 'lucide-react';
import {KNOWLEDGE_VERSION} from '@/lib/knowledge/catalog.mjs';
import {searchKnowledge, type KnowledgeArticle, type KnowledgeBook, type KnowledgeContext} from '@/lib/knowledge/model.mjs';
import './knowledge.css';

type Query = Record<string, string | string[] | undefined>;
type Props = {base:string; label:string; context:KnowledgeContext; books:KnowledgeBook[]; book?:KnowledgeBook; entry?:KnowledgeArticle; query:Query; roleLinks?:{title:string;href:string}[]};
const scalar = (value: Query[string]) => typeof value === 'string' ? value : '';
const articleHref = (base:string,book:string,entry:string) => `${base}/${encodeURIComponent(book)}/${encodeURIComponent(entry)}`;

function ArticleSections({entry}:{entry:KnowledgeArticle}) {
  return <div className="kb-prose">{entry.sections.map((section,index) => {
    const groups:{kind:string;text:string[]}[]=[];
    for(const block of section.blocks) {
      const last=groups.at(-1);
      if (block.kind !== 'paragraph' && last?.kind===block.kind) last.text.push(block.text);
      else groups.push({kind:block.kind,text:[block.text]});
    }
    return <section key={index} id={`onderdeel-${index+1}`} className={section.heading==='Voorbeeld'||section.heading==='Voorbeelden'?'kb-example':''}>
      <h2>{section.heading}</h2>{groups.map((group,i) => group.kind==='step'?<ol key={i}>{group.text.map((text,j)=><li key={j}>{text}</li>)}</ol>:group.kind==='bullet'?<ul key={i}>{group.text.map((text,j)=><li key={j}>{text}</li>)}</ul>:<p key={i}>{group.text[0]}</p>)}
    </section>;
  })}</div>;
}

export function KnowledgeBank({base,label,context,books,book,entry,query,roleLinks=[]}:Props) {
  const selection=Object.fromEntries(['household','season'].flatMap(key=>{const value=scalar(query[key]);return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)?[[key,value]]:[]}));
  const withSelection=(path:string)=>{const params=new URLSearchParams(selection);return params.size?`${path}${path.includes('?')?'&':'?'}${params}`:path;};
  const q=scalar(query.q).slice(0,180);
  const guide=book?.id || scalar(query.guide);
  const validGuide=books.some(b=>b.id===guide)?guide:'';
  const all=searchKnowledge(books,context,q,validGuide);
  const page=Math.min(Math.max(1,Number.parseInt(scalar(query.page),10)||1),Math.max(1,Math.ceil(all.length/24)));
  const results=all.slice((page-1)*24,page*24);
  const scopeName=context.environment==='personal'?'Persoonlijke werkruimte':context.environment==='club'?'Verenigingsbeheer':'Platformbeheer';
  const current=entry?articleHref(base,book!.id,entry.id):book?`${base}/${book.id}`:base;
  const nextPage=(n:number)=>{const params=new URLSearchParams();if(q)params.set('q',q);if(validGuide&&!book)params.set('guide',validGuide);params.set('page',String(n));return withSelection(`${current}?${params}`);};
  const visible=books.flatMap(b=>b.articles.map(e=>({book:b,entry:e})));
  const related=entry?.related.flatMap(id=>{const found=visible.find(item=>item.entry.id===id);return found?[found]:[]}) ?? [];
  return <div className="knowledge-bank" data-knowledge-environment={context.environment} data-knowledge-version={KNOWLEDGE_VERSION}>
    <nav className="kb-breadcrumbs" aria-label="Kennisbankpad"><Link href={withSelection(base)}>Kennisbank</Link>{book&&<><span aria-hidden="true">/</span>{entry?<Link href={withSelection(`${base}/${book.id}`)}>{book.title}</Link>:<span aria-current="page">{book.title}</span>}</>}{entry&&<><span aria-hidden="true">/</span><span aria-current="page">Artikel</span></>}</nav>
    <header className="kb-heading"><span className="kb-eyebrow"><BookOpen size={17}/>{scopeName} · {label}</span><h1>{entry?.title ?? book?.title ?? 'Kennisbank'}</h1><p>{entry?.summary ?? book?.description ?? 'Uitleg en stappenplannen voor jouw werkzaamheden. Kies een onderwerp of zoek in de artikelen die bij jouw toegang horen.'}</p>{entry&&<span className="kb-reading"><ListChecks size={15}/> {Math.max(1,Math.ceil(entry.sections.flatMap(s=>s.blocks).map(b=>b.text).join(' ').split(/\s+/).length/180))} minuten leestijd · Bijgewerkt 10 oktober 2026</span>}</header>
    {entry?<>
      <div className="kb-article-layout"><aside className="kb-contents" aria-label="In dit artikel"><h2>In dit artikel</h2><ol>{entry.sections.map((section,i)=><li key={i}><a href={`#onderdeel-${i+1}`}>{section.heading}</a></li>)}</ol><Link className="kb-back" href={withSelection(`${base}/${book!.id}`)}><ArrowLeft size={16}/>Alle artikelen</Link></aside><article className="kb-article"><ArticleSections entry={entry}/></article></div>
      {related.length>0&&<section className="kb-related"><h2>Lees ook</h2><div className="kb-cards">{related.map(({book:b,entry:e})=><Link key={e.id} className="kb-card" href={withSelection(articleHref(base,b.id,e.id))}><span className="kb-card-group">{b.title}</span><h3>{e.title}</h3><p>{e.summary}</p><span className="kb-card-link">Lees het artikel <ArrowRight size={16}/></span></Link>)}</div></section>}
    </>:<>
      <form className="kb-search" action={current} method="get" role="search" aria-label="Zoeken in de kennisbank">{Object.entries(selection).map(([name,value])=><input key={name} type="hidden" name={name} value={value}/>)}<div className="kb-search-field"><label htmlFor="kb-q">Zoek een onderwerp</label><div><Search size={18}/><input id="kb-q" name="q" defaultValue={q} maxLength={180} placeholder="Bijvoorbeeld: winterdoel, overdracht, afmelden" type="search"/></div></div>{!book&&books.length>1&&<div className="kb-guide-filter"><label htmlFor="kb-guide">Kennisbank</label><select id="kb-guide" name="guide" defaultValue={validGuide}><option value="">Alle beschikbare rollen</option>{books.map(b=><option key={b.id} value={b.id}>{b.title}</option>)}</select></div>}<button type="submit">Zoeken</button></form>
      {!book&&!q&&!validGuide&&<section className="kb-books" aria-label="Jouw kennisbanken">{books.map(b=><Link key={b.id} className="kb-book" href={withSelection(`${base}/${b.id}`)}><BookOpen size={24}/><div><h2>{b.title}</h2><p>{b.description}</p><span>{b.articles.length} artikelen</span></div><ArrowRight size={18}/></Link>)}</section>}
      <div className="kb-results-heading"><h2>{q?'Zoekresultaten':'Artikelen'}</h2><p role="status">{all.length} {all.length===1?'artikel':'artikelen'}{q?` voor “${q}”`:''}{validGuide&&` · ${books.find(b=>b.id===validGuide)?.title}`}</p>{(q||validGuide&&!book)&&<Link href={withSelection(current)}>Filters wissen</Link>}</div>
      {results.length?<div className="kb-cards">{results.map(({bookId,bookTitle,entry:e})=><Link key={e.id} className="kb-card" href={withSelection(articleHref(base,bookId,e.id))}><span className="kb-card-group">{bookTitle}</span><h3>{e.title}</h3><p>{e.summary}</p><span className="kb-card-link">Lees het artikel <ArrowRight size={16}/></span></Link>)}</div>:<div className="kb-empty"><h3>Geen artikelen gevonden</h3><p>Probeer een korter zoekwoord of kies een andere beschikbare kennisbank.</p><Link href={withSelection(current)}>Zoekopdracht wissen</Link></div>}
      {all.length>24&&<nav className="kb-pagination" aria-label="Artikelpagina's">{page>1&&<Link href={nextPage(page-1)}><ArrowLeft size={16}/>Vorige</Link>}<span>Pagina {page} van {Math.ceil(all.length/24)}</span>{page*24<all.length&&<Link href={nextPage(page+1)}>Volgende<ArrowRight size={16}/></Link>}</nav>}
      {roleLinks.length>0&&<section className="kb-role-links"><h2>Andere werkruimtes</h2><p>Voor je beheertaken gebruik je de kennisbank in de betreffende werkruimte.</p>{roleLinks.map(link=><Link key={link.href} href={link.href}>{link.title}<ArrowRight size={16}/></Link>)}</section>}
    </>}
    <footer className="kb-footer">Je actuele verenigingsafspraak en vastgelegde besluit blijven leidend. Ontbreekt een bevoegd onderdeel, laat je benoemde toegang controleren.</footer>
  </div>;
}
