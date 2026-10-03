import { extractDocument, MAX_EXTRACTED_CHARS } from './extract.ts';
import { zipSync, strToU8 } from 'fflate';
const assert = (v: unknown, message = 'assertion failed') => { if (!v) throw new Error(message); };
const zip = (parts: Record<string,string>) => zipSync(Object.fromEntries(Object.entries(parts).map(([k,v])=>[k,strToU8(v)])));
const rejected = async (bytes: Uint8Array, name: string) => { try { await extractDocument(bytes,name); } catch(e) { assert(e.code==='UNSUPPORTED_DOCUMENT'); return; } throw new Error('must reject'); };
const rels = (items: string) => `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${items}</Relationships>`;
const rel = (id: string,target: string) => `<Relationship Id="${id}" Target="${target}"/>`;
const book = `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Revenue" sheetId="1" r:id="one"/><sheet name="Costs" sheetId="2" r:id="two" state="hidden"/></sheets></workbook>`;
export const workbookFixture = () => zip({
 'xl/workbook.xml':book,
 'xl/_rels/workbook.xml.rels':rels(rel('one','worksheets/sheet2.xml')+rel('two','worksheets/sheet1.xml')),
 'xl/sharedStrings.xml':'<sst><si><t>Revenue in USD</t></si><si><r><t>North </t></r><r><t>region</t></r></si></sst>',
 'xl/styles.xml':'<styleSheet><cellXfs><xf numFmtId="0"/><xf numFmtId="14"/><xf numFmtId="9"/></cellXfs></styleSheet>',
 'xl/worksheets/sheet2.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B2"><v>1200</v></c><c r="C2" s="2"><v>0.25</v></c><c r="D2" s="1"><v>45292</v></c><c r="E2"><f>B2*2</f><v>2400</v></c><c r="F2"><f>B2/0</f></c></row></sheetData></worksheet>',
 'xl/worksheets/sheet1.xml':'<worksheet><sheetData><row><c r="A1" t="s"><v>1</v></c><c r="B2" t="inlineStr"><is><t>Cost is 300 USD.</t></is></c></row></sheetData></worksheet>',
});
const slide = (text: string) => `<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:r><a:t>${text}</a:t></a:r></a:p></p:sld>`;
export const slidesFixture = () => zip({
 'ppt/presentation.xml':'<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="two"/><p:sldId r:id="one"/></p:sldIdLst></p:presentation>',
 'ppt/_rels/presentation.xml.rels':rels(rel('one','slides/slide1.xml')+rel('two','slides/slide2.xml')),
 'ppt/slides/slide1.xml':slide('Budget 12000 USD. Launch postponed.'),
 'ppt/slides/slide2.xml':slide('Cedar project: Lena owns design, due 12 November.'),
 'ppt/slides/_rels/slide2.xml.rels':rels(rel('notes','../notesSlides/notesSlide2.xml')),
 'ppt/notesSlides/notesSlide2.xml':slide('Omar must test accessibility before release.'),
});
Deno.test('XLSX preserves workbook order, sheet/cell identity, rich strings, dates and formula caveats',async()=>{
 const {text,mimeType}=await extractDocument(workbookFixture(),'budget.xlsx');
 assert(mimeType.includes('spreadsheet')); assert(text.indexOf('Sheet "Revenue"')<text.indexOf('Sheet "Costs"'));
 for(const s of ['B2: "1200"','C2: "25%"','2024-01-01','cached formula result','Formula has no saved result','North region','hidden']) assert(text.includes(s),s+' missing: '+text);
});
Deno.test('PPTX uses presentation order and includes speaker notes, not filename order',async()=>{
 const {text}=await extractDocument(slidesFixture(),'brief.pptx');
 assert(text.indexOf('Lena')<text.indexOf('Budget'));assert(text.includes('[Slide 2]'));assert(text.includes('[Speaker notes]\nOmar'));
});
Deno.test('ODT preserves paragraphs/tables and excludes deleted/annotation content',async()=>{
 const bytes=zip({mimetype:'application/vnd.oasis.opendocument.text','content.xml':'<office:document-content xmlns:office="urn:o" xmlns:text="urn:t" xmlns:table="urn:table"><text:h>Cedar</text:h><text:p>Lena<text:s text:c="2"/>owns design.</text:p><office:annotation><text:p>Do not summarize me.</text:p></office:annotation><table:table-cell><text:p>1200 USD</text:p></table:table-cell></office:document-content>'});
 const {text}=await extractDocument(bytes,'notes.odt');assert(text.includes('Lena  owns design'));assert(text.includes('1200 USD'));assert(!text.includes('Do not summarize'));
});
Deno.test('Markdown, JSON, TSV support Unicode; malformed JSON and unsafe XML are rejected',async()=>{
 assert((await extractDocument(strToU8('# Plan\nՀայերեն: design due Friday.'),'plan.md')).text.includes('Հայերեն'));
 assert((await extractDocument(strToU8('{"budget":1200}'),'data.json')).text.includes('1200'));
 const tsv=await extractDocument(strToU8('Owner\tTask\nLena\t"Design\nand test"'),'tasks.tsv');assert(tsv.text.includes('Design\\nand test'));
 await rejected(strToU8('{broken'),'bad.json');
 await rejected(zip({'xl/workbook.xml':'<!DOCTYPE a [<!ENTITY x SYSTEM "file:///etc/passwd">]><a>&x;</a>'}),'attack.xlsx');
 await rejected(zip({'xl/workbook.xml':book,'xl/_rels/workbook.xml.rels':rels('<Relationship Id="one" Target="https://example.com/evil" TargetMode="External"/>')}),'external.xlsx');
});
Deno.test('new text formats keep the existing explicit truncation boundary',async()=>{
 const x=await extractDocument(strToU8('# Title\n'+'x'.repeat(MAX_EXTRACTED_CHARS)),'large.md');assert(x.truncated&&x.text.length===MAX_EXTRACTED_CHARS);
});
