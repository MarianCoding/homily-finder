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


if (typeof module!=='undefined') module.exports={D,addD,dow,iso,same,diffW,fmt,ord,easter,sundayOnOrAfter,sundayOnOrBefore,keys,liturgy,findInYear,dayName};
