// Run from the repository root: node desktop-fix/primijeni.cjs
const fs=require('node:fs'),path=require('node:path');
const root=process.cwd(),src=path.join(root,'apps/web/src');
const main=path.join(src,'main.tsx'),editor=path.join(src,'pages/GroupAddExpensePage.tsx');
if(!fs.existsSync(main)||!fs.existsSync(editor))throw Error('Pokreni iz korijena projekta koji sadrzi apps/web/src.');
const originalMain=fs.readFileSync(main,'utf8'),originalEditor=fs.readFileSync(editor,'utf8');
if(!originalEditor.includes('draftItemEditor'))throw Error('Nepoznata verzija obrasca. Nista nije promijenjeno.');
const dateLabel=/<label>\s*\{t\("billDate"\)\}\s*<input\s+type="date"[\s\S]*?\/>\s*<\/label>/g;
let updatedEditor=originalEditor.replace(dateLabel,'');
if(updatedEditor.includes('type="date"'))throw Error('Polje datuma ima drugaciji oblik. Nista nije promijenjeno; posalji GroupAddExpensePage.tsx.');
const cssImport='import "./styles/desktopReceiptLayout.css";';
const updatedMain=originalMain.includes(cssImport)?originalMain:originalMain+'\n'+cssImport+'\n';
const backup=path.join(root,'.splitit-backups','desktop-'+Date.now());
function saveBackup(file){const dest=path.join(backup,path.relative(root,file));fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);}
const cssFile=path.join(src,'styles/desktopReceiptLayout.css');
for(const file of [main,editor,cssFile])if(fs.existsSync(file))saveBackup(file);
fs.mkdirSync(path.dirname(cssFile),{recursive:true});fs.copyFileSync(path.join(__dirname,'desktopReceiptLayout.css'),cssFile);
fs.writeFileSync(main,updatedMain);fs.writeFileSync(editor,updatedEditor);
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const files=walk(src),sources=files.filter(f=>/\.(tsx?|jsx?|mjs|cjs|json|css)$/.test(f));
// Conservative: keep all backups if any source references a .backup file.
const referenced=sources.some(f=>fs.readFileSync(f,'utf8').includes('.backup'));
let moved=0;
for(const file of files.filter(f=>f.endsWith('.jsx.backup'))){
 const tsx=file.slice(0,-'.jsx.backup'.length)+'.tsx';
 if(referenced||!fs.existsSync(tsx)){console.log('Ostavljeno radi provjere:',path.relative(root,file));continue;}
 saveBackup(file);fs.unlinkSync(file);moved++;
}
console.log('Desktop raspored i polje datuma su prilagodeni.');
console.log('Broj .jsx.backup datoteka premjestenih iz src:',moved);
console.log('Sigurnosne kopije:',path.relative(root,backup));
console.log('Sada pokreni: npm run build -w @splitit/web');
