/* ---------- date helpers ---------- */
const D = (y,m,d) => new Date(Date.UTC(y,m-1,d));
const addD = (dt,n) => new Date(dt.getTime()+n*864e5);
const dow = dt => dt.getUTCDay();
const iso = dt => dt.toISOString().slice(0,10);
const same = (a,b) => a.getTime()===b.getTime();
const diffW = (a,b) => Math.round((a-b)/6048e5);
const fmt = dt => dt.toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'long',day:'numeric',year:'numeric'});
const ord = n => n+(['th','st','nd','rd'][(n%100>>3^1&&n%10)||0]||'th');

function easter(y){ // Meeus/Jones/Butcher
  const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),
  h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),
  mo=Math.floor((h+l-7*m+114)/31),da=((h+l-7*m+114)%31)+1; return D(y,mo,da);
}
function sundayOnOrAfter(dt){ return addD(dt,(7-dow(dt))%7); }
function sundayOnOrBefore(dt){ return addD(dt,-dow(dt)); }

/* key dates for a calendar year */
function keys(y){
  const E=easter(y);
  const adv1=sundayOnOrAfter(D(y,11,27));
  const epiph=sundayOnOrAfter(D(y,1,2));
  let bapt=addD(epiph,7); let baptSun=bapt;
  if (epiph.getUTCDate()>=7){ bapt=addD(epiph,1); baptSun=epiph; } // US: Baptism moves to Monday
  const prevAdv1=sundayOnOrAfter(D(y-1,11,27));
  return {E,adv1,epiph,bapt,baptSun,ash:addD(E,-46),pent:addD(E,49),ctk:addD(adv1,-7),prevAdv1};
}

/* Liturgical identity of a date: {id, title, color, kind, cycle} */
function liturgy(dt){
  const y=dt.getUTCFullYear(), m=dt.getUTCMonth()+1, d=dt.getUTCDate(), K=keys(y), sun=dow(dt)===0;
  const litYear = dt>=K.adv1 ? y+1 : y;
  const cycle = ['C','A','B'][litYear%3];
  const wk = litYear%2 ? 'I' : 'II';
  const out = (id,title,color,kind='feast') => ({id,title,color,kind,cycle,wk});
  const md=(mm,dd)=>m===mm&&d===dd;

  // Fixed solemnities that take precedence over Sundays
  if (md(12,25)) return out('F-12-25','The Nativity of the Lord (Christmas)','white');
  if (md(1,1))  return out('F-1-1','Solemnity of Mary, Mother of God','white');
  if (md(8,15)) return out('F-8-15','The Assumption of the Blessed Virgin Mary','white');
  if (md(11,1)) return out('F-11-1','All Saints','white');
  if (md(12,8) && !sun) return out('F-12-8','The Immaculate Conception','white');
  if (md(12,9) && dow(dt)===1 && dow(D(y,12,8))===0) return out('F-12-8','The Immaculate Conception (transferred)','white');
  if (md(11,2) && !(same(dt,K.adv1))) return out('F-11-2','The Commemoration of All the Faithful Departed (All Souls)','violet');
  if (sun && md(2,2))  return out('F-2-2','The Presentation of the Lord','white');
  if (sun && md(8,6))  return out('F-8-6','The Transfiguration of the Lord','white');
  if (sun && md(9,14)) return out('F-9-14','The Exaltation of the Holy Cross','red');
  if (sun && md(11,9)) return out('F-11-9','Dedication of the Lateran Basilica','white');
  if (sun && md(6,24) && dt>K.pent) return out('F-6-24','The Nativity of St John the Baptist','white');
  if (sun && md(6,29) && dt>K.pent) return out('F-6-29','Saints Peter and Paul','red');

  // Christmas season
  if (dt>=D(y,12,26) && dt<=D(y,12,31)){
    if (sun) return out('HolyFamily','The Holy Family of Jesus, Mary and Joseph','white');
    if (md(12,30) && dow(D(y,12,25))===0) return out('HolyFamily','The Holy Family of Jesus, Mary and Joseph','white');
    return out('Xmas-oct-'+d,`${ord(d-24)} day in the Octave of Christmas`,'white','weekday');
  }
  if (dt<K.bapt || same(dt,K.bapt)){
    if (same(dt,K.epiph)) return out('Epiphany','The Epiphany of the Lord','white');
    if (same(dt,K.bapt))  return out('Baptism','The Baptism of the Lord','white');
    if (sun) return out('Xmas-2Sun','Second Sunday after the Nativity','white');
    return out('Xmas-wk-'+m+'-'+d,'Weekday of the Christmas season','white','weekday');
  }

  // Triduum & Lent
  if (same(dt,addD(K.E,-3))) return out('HolyThu','Holy Thursday — Mass of the Lord\'s Supper','white');
  if (same(dt,addD(K.E,-2))) return out('GoodFri','Good Friday of the Lord\'s Passion','red');
  if (same(dt,addD(K.E,-1))) return out('HolySat','Holy Saturday — The Easter Vigil','white');
  if (same(dt,K.ash)) return out('AshWed','Ash Wednesday','violet');
  if (dt>K.ash && dt<K.E){
    if (same(dt,addD(K.E,-7))) return out('PalmSun','Palm Sunday of the Passion of the Lord','red');
    const s=sundayOnOrBefore(dt); const n=diffW(s,addD(K.E,-42))+1;
    if (n<1) return out('Lent-0-'+dow(dt),`${dayName(dt)} after Ash Wednesday`,'violet','weekday');
    if (sun) return out('Lent-'+n,`${ord(n)} Sunday of Lent`,n===4?'rose':'violet');
    if (n===6) return out('HolyWk-'+dow(dt),`${dayName(dt)} of Holy Week`,'violet','weekday');
    return out('Lent-'+n+'-'+dow(dt),`${dayName(dt)} of the ${ord(n)} Week of Lent`,'violet','weekday');
  }

  // Easter season
  if (dt>=K.E && dt<=K.pent){
    if (same(dt,K.E)) return out('Easter','Easter Sunday of the Resurrection of the Lord','white');
    if (same(dt,K.pent)) return out('Pentecost','Pentecost Sunday','red');
    const n=diffW(sundayOnOrBefore(dt),K.E)+1;
    if (same(dt,addD(K.E,39))) return out('Ascension','The Ascension of the Lord (Thursday; many US dioceses transfer to Sunday)','white');
    if (sun){
      if (n===2) return out('Easter-2','2nd Sunday of Easter (Divine Mercy Sunday)','white');
      if (n===7) return out('Easter-7','7th Sunday of Easter — The Ascension where transferred','white');
      return out('Easter-'+n,`${ord(n)} Sunday of Easter`,'white');
    }
    if (n===1) return out('Easter-oct-'+dow(dt),`${dayName(dt)} within the Octave of Easter`,'white','weekday');
    return out('Easter-'+n+'-'+dow(dt),`${dayName(dt)} of the ${ord(n)} Week of Easter`,'white','weekday');
  }

  // Advent
  if (dt>=K.adv1 && dt<D(y,12,25)){
    const n=diffW(sundayOnOrBefore(dt),K.adv1)+1;
    if (sun) return out('Advent-'+n,`${ord(n)} Sunday of Advent`,n===3?'rose':'violet');
    if (d>=17) return out('Advent-late-'+d,`December ${d} (late Advent weekday)`,'violet','weekday');
    return out('Advent-'+n+'-'+dow(dt),`${dayName(dt)} of the ${ord(n)} Week of Advent`,'violet','weekday');
  }

  // Ordinary Time
  const s=sundayOnOrBefore(dt);
  let n;
  if (dt<K.ash) n=diffW(s,K.baptSun)+1; else n=34-diffW(K.ctk,s);
  if (sun){
    if (same(dt,addD(K.pent,7)))  return out('Trinity','The Most Holy Trinity','white');
    if (same(dt,addD(K.pent,14))) return out('CorpusChristi','The Most Holy Body and Blood of Christ (Corpus Christi)','white');
    if (same(dt,K.ctk)) return out('ChristKing','Our Lord Jesus Christ, King of the Universe','white');
    return out('OT-'+n,`${ord(n)} Sunday in Ordinary Time`,'green');
  }
  if (same(dt,addD(K.pent,19))) return out('SacredHeart','The Most Sacred Heart of Jesus','white');
  return out('OT-'+n+'-'+dow(dt),`${dayName(dt)} of the ${ord(n)} Week in Ordinary Time`,'green','weekday');
}
function dayName(dt){ return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][dow(dt)]; }

/* find the date with the same liturgical id in a given calendar year */
function findInYear(id,y){
  for (let dt=D(y,1,1); dt.getUTCFullYear()===y; dt=addD(dt,1)){
    if (liturgy(dt).id===id) return dt;
  }
  return null;
}

/* ---------- scripture references ---------- */
const BOOKS = (() => {
  const raw = {
    gn:'gen genesis', ex:'ex exod exodus', lv:'lv lev leviticus', nm:'nm num numbers', dt:'dt deut deuteronomy',
    jos:'jos josh joshua', jgs:'jgs judg judges', ru:'ru ruth', '1sm':'1sm 1sam 1samuel', '2sm':'2sm 2sam 2samuel',
    '1kgs':'1kgs 1kings', '2kgs':'2kgs 2kings', '1chr':'1chr 1chronicles', '2chr':'2chr 2chronicles',
    ezr:'ezr ezra', neh:'neh nehemiah', tb:'tb tob tobit', jdt:'jdt judith', est:'est esth esther',
    '1mc':'1mc 1macc 1maccabees', '2mc':'2mc 2macc 2maccabees', jb:'jb job', ps:'ps pss psalm psalms',
    prv:'prv prov proverbs', eccl:'eccl ecclesiastes qoheleth', sg:'sg song songofsongs canticle',
    wis:'wis wisdom', sir:'sir sirach ecclesiasticus', is:'is isa isaiah', jer:'jer jeremiah',
    lam:'lam lamentations', bar:'bar baruch', ez:'ez ezek ezekiel', dn:'dn dan daniel', hos:'hos hosea',
    jl:'jl joel', am:'am amos', ob:'ob obad obadiah', jon:'jon jonah', mi:'mi mic micah', na:'na nah nahum',
    hb:'hb hab habakkuk', zep:'zep zeph zephaniah', hg:'hg hag haggai', zec:'zec zech zechariah',
    mal:'mal malachi', mt:'mt matt matthew', mk:'mk mark', lk:'lk luke', jn:'jn john', acts:'acts',
    rom:'rom romans', '1cor':'1cor 1corinthians', '2cor':'2cor 2corinthians', gal:'gal galatians',
    eph:'eph ephesians', phil:'phil philippians', col:'col colossians', '1thes':'1thes 1thess 1thessalonians',
    '2thes':'2thes 2thess 2thessalonians', '1tm':'1tm 1tim 1timothy', '2tm':'2tm 2tim 2timothy',
    ti:'ti tit titus', phlm:'phlm philemon', heb:'heb hebrews', jas:'jas james', '1pt':'1pt 1pet 1peter',
    '2pt':'2pt 2pet 2peter', '1jn':'1jn 1john', '2jn':'2jn 2john', '3jn':'3jn 3john', jude:'jude',
    rv:'rv rev revelation apocalypse',
  };
  const map = {};
  for (const [code, names] of Object.entries(raw)) for (const n of names.split(' ')) map[n] = code;
  return map;
})();
const BOOK_LABEL = { gn:'Genesis', ex:'Exodus', lv:'Leviticus', nm:'Numbers', dt:'Deuteronomy', jos:'Joshua',
  jgs:'Judges', ru:'Ruth', '1sm':'1 Samuel', '2sm':'2 Samuel', '1kgs':'1 Kings', '2kgs':'2 Kings',
  '1chr':'1 Chronicles', '2chr':'2 Chronicles', ezr:'Ezra', neh:'Nehemiah', tb:'Tobit', jdt:'Judith',
  est:'Esther', '1mc':'1 Maccabees', '2mc':'2 Maccabees', jb:'Job', ps:'Psalm', prv:'Proverbs',
  eccl:'Ecclesiastes', sg:'Song of Songs', wis:'Wisdom', sir:'Sirach', is:'Isaiah', jer:'Jeremiah',
  lam:'Lamentations', bar:'Baruch', ez:'Ezekiel', dn:'Daniel', hos:'Hosea', jl:'Joel', am:'Amos',
  ob:'Obadiah', jon:'Jonah', mi:'Micah', na:'Nahum', hb:'Habakkuk', zep:'Zephaniah', hg:'Haggai',
  zec:'Zechariah', mal:'Malachi', mt:'Matthew', mk:'Mark', lk:'Luke', jn:'John', acts:'Acts', rom:'Romans',
  '1cor':'1 Corinthians', '2cor':'2 Corinthians', gal:'Galatians', eph:'Ephesians', phil:'Philippians',
  col:'Colossians', '1thes':'1 Thessalonians', '2thes':'2 Thessalonians', '1tm':'1 Timothy', '2tm':'2 Timothy',
  ti:'Titus', phlm:'Philemon', heb:'Hebrews', jas:'James', '1pt':'1 Peter', '2pt':'2 Peter', '1jn':'1 John',
  '2jn':'2 John', '3jn':'3 John', jude:'Jude', rv:'Revelation' };
// tokens too short/common to trust without a chapter:verse after them
const AMBIG = new Set(['is','am','jb','sg','na','ob','jl','mi','hb','hg','ti','ru','ex','dn','dt','jn','mk','mt','lk','ez','jer','ps']);
const normBook = w => BOOKS[w.toLowerCase().replace(/\./g,'').replace(/\s+/g,'')] || null;

// Pull structured refs out of free text. Returns [[book, chapter, v1, v2], ...]
function extractRefs(text){
  const out = [];
  const re = /\b((?:[123]\s?)?[A-Za-z]+)\.?\s+(\d{1,3})(?::\s*(\d{1,3})(?:\s*[-\u2013\u2014]\s*(?:(\d{1,3})\s*:\s*)?(\d{1,3}))?((?:\s*,\s*\d{1,3}(?:\s*[-\u2013\u2014]\s*\d{1,3})?)*))?/g;
  let m;
  while ((m = re.exec(text))){
    const b = normBook(m[1]); if (!b) continue;
    const isAbbrev = m[1].replace(/\./g,'').length <= 3;
    if (isAbbrev && AMBIG.has(b) && !m[3]) continue;           // "is 3" in prose isn't Isaiah 3
    const c = +m[2]; if (!c || c > 176) continue;
    if (!m[3]) { out.push([b, c, 0, 0]); continue; }           // chapter only
    const v1 = +m[3];
    let vmax = m[5] ? +m[5] : v1;
    if (m[6]) for (const n of m[6].match(/\d{1,3}/g)) vmax = Math.max(vmax, +n);   // "10, 11, 12-13, 14"
    if (m[4]) { out.push([b, c, v1, 999]); out.push([b, +m[4], 1, vmax]); }        // spans chapters
    else out.push([b, c, v1, vmax]);
  }
  return out;
}
function refMatches(q, r){         // q = parsed query, r = stored ref
  if (q[0] !== r[0]) return false;
  if (!q[1]) return true;                                       // book only
  if (q[1] !== r[1]) return false;
  if (!q[2]) return true;                                       // chapter only
  if (!r[2]) return true;                                       // stored ref is whole chapter
  return q[2] <= r[3] && (q[3] || q[2]) >= r[2];                // verse ranges overlap
}
function parseQuery(qtext){
  const t = qtext.trim();
  let m = t.match(/^((?:[123]\s?)?[A-Za-z .]+?)\s*(?:(\d{1,3})(?::(\d{1,3})(?:\s*[-\u2013\u2014]\s*(\d{1,3}))?)?)?$/);
  if (!m) return null;
  const b = normBook(m[1]); if (!b) return null;
  return [b, m[2] ? +m[2] : 0, m[3] ? +m[3] : 0, m[4] ? +m[4] : 0];
}

/* spoken-form references: "the thirteenth chapter of Matthew's Gospel",
   "Luke, chapter 15, verses 1 to 10", "chapter 8 of Romans" */
const ORDW = (() => {
  const u=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth','eleventh','twelfth',
   'thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth','nineteenth'];
  const t=['','','twent','thirt','fort','fift','sixt','sevent','eight','ninet'];
  const m={};
  for (let i=1;i<20;i++) m[u[i]]=i;
  for (let ten=2;ten<10;ten++){ m[t[ten]+'ieth']=ten*10;
    for (let i=1;i<10;i++) m[t[ten]+'y-'+u[i]]=ten*10+i, m[t[ten]+'y '+u[i]]=ten*10+i; }
  return m;
})();
const numWord = w => { w=w.toLowerCase(); if (ORDW[w]) return ORDW[w]; const m=w.match(/^(\d{1,3})(?:st|nd|rd|th)?$/); return m?+m[1]:null; };
const cleanBookWord = w => w.replace(/[\u2019']s$/i,'').replace(/\.$/,'');
const bookOf = w => { w=cleanBookWord(w); return normBook(w) || (/s$/i.test(w) ? normBook(w.slice(0,-1)) : null); };
function spokenRefs(text){
  const out=[]; let m;
  const ORD='(?:\\d{1,3}(?:st|nd|rd|th)?|[a-z]+(?:[ -][a-z]+)?)';
  // "the Nth chapter of (the (book|gospel|letter) of/to (the)) X"
  let re=new RegExp("\\b(?:the\\s+)?("+ORD+")\\s+chapter\\s+of\\s+(?:the\\s+)?(?:book\\s+of\\s+|gospel\\s+of\\s+|prophet\\s+|letter\\s+(?:of\\s+(?:st\\.?\\s+)?paul\\s+)?to\\s+the\\s+|letter\\s+to\\s+)?(?:st\\.?\\s+)?((?:[123]\\s)?[A-Za-z]+[\\u2019']?s?)","gi");
  while ((m=re.exec(text))){ const c=numWord(m[1]); const b=bookOf(m[2]); if (b&&c&&c<=176) out.push([b,c,0,0]); }
  // "X, chapter N(, verse(s) A (to|through|-) B)"
  re=/\b((?:[123]\s)?[A-Za-z]+[\u2019']?s?)(?:\s+gospel)?\s*,?\s+chapter\s+(\d{1,3}|[a-z]+(?:[ -][a-z]+)?)(?:\s*,?\s+verses?\s+(\d{1,3})(?:\s*(?:to|through|[-\u2013])\s*(\d{1,3}))?)?/gi;
  while ((m=re.exec(text))){ const b=bookOf(m[1]); const c=numWord(m[2]); if (!b||!c||c>176) continue;
    const v1=m[3]?+m[3]:0; out.push([b,c,v1,m[4]?+m[4]:v1]); }
  return out;
}

if (typeof module!=='undefined') module.exports={D,addD,dow,iso,same,diffW,fmt,ord,easter,sundayOnOrAfter,sundayOnOrBefore,keys,liturgy,findInYear,dayName,extractRefs,spokenRefs,refMatches,parseQuery,BOOK_LABEL};
