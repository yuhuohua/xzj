function getSolarFromLunar(year, month, day) {
    if (year < 1900 || year > 2100) return null;
    let offset = 0;
    for (let i = 1900; i < year; i++) {
        offset += lYearDays(i);
    }
    let leapMonth = lunarInfo[year - 1900] & 0xf;
    for (let m = 1; m < month; m++) {
        let daysInMonth = (lunarInfo[year - 1900] & (0x10000 >> m)) ?
        30 : 29;
        offset += daysInMonth;
        
        if (leapMonth > 0 && m === leapMonth) {
             offset += ((lunarInfo[year - 1900] & 0x10000) ? 30 : 29);
        }
    }
    
    offset += (day - 1);
    let baseDate = new Date(1900, 0, 31);
    baseDate.setDate(baseDate.getDate() + offset);
    return baseDate;
}

function lYearDays(y){let i,sum=348;for(i=0x8000;i>0x8;i>>=1)sum+=(lunarInfo[y-1900]&i)?1:0;return sum+((lunarInfo[y-1900]&0xf)?((lunarInfo[y-1900]&0x10000)?30:29):0);}
function getSolarTerm(date) {
  const solarTerms = ["小寒", "大寒", "立春", "雨水", "惊蛰", "春分", "清明", "谷雨", "立夏", "小满", "芒种", "夏至", "小暑", "大暑", "立秋", "处暑", "白露", "秋分", "寒露", "霜降", "立冬", "小雪", "大雪", "冬至"];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const cVal = [5.4055, 20.12, 3.87, 18.73, 5.63, 20.646, 4.81, 20.1, 5.52, 21.04, 5.678, 21.37, 7.108, 22.83, 7.5, 23.13, 7.646, 23.042, 8.318, 23.438, 7.438, 22.36, 7.18, 21.94];
  if (year < 2000 || year > 2099) return "";
  function calcDay(y, index) { return Math.floor((y - 2000) * 0.2422 + cVal[index]) - Math.floor((y - 2000) / 4);
  }
  let idx1 = (month - 1) * 2;
  let d1 = calcDay(year, idx1);
  if (day === d1) return solarTerms[idx1];
  let idx2 = (month - 1) * 2 + 1;
  let d2 = calcDay(year, idx2);
  if (day === d2) return solarTerms[idx2];
  return null;
}
function getMonthGrid(y,m){const f=new Date(y,m,1);const l=new Date(y,m+1,0);const days=l.getDate();const start=f.getDay();const g=[];let w=Array(start).fill(null);for(let i=1;i<=days;i++){w.push(i);if(w.length===7){g.push(w);w=[];}}if(w.length>0){while(w.length<7)w.push(null);g.push(w);}return g;}
function getStemBranchDay(date){const b=new Date(1900,0,31);const diff=Math.floor((date-b)/86400000);return heavenlyStems[(diff%10+10)%10]+earthlyBranches[(diff%12+12)%12];}
function getYellowBlackDay(date){let ld=getLunarDate_Precise_Simple(date);return yellowBlackDays[(ld.m+ld.d-2)%12];}
function getLunarDate_Precise_Simple(date){let y=date.getFullYear(),m=date.getMonth()+1,d=date.getDate();let i,sum=348,offset=(Date.UTC(y,m-1,d)-Date.UTC(1900,0,31))/86400000;for(i=1900;i<2101&&offset>0;i++){sum=lYearDays(i);offset-=sum;}if(offset<0){offset+=sum;i--;}let leap=lunarInfo[i-1900]&0xf,isLeap=false,j,md;for(j=1;j<13&&offset>0;j++){md=(leap===j-1&&!isLeap)?((lunarInfo[i-1900]&0x10000)?30:29):((lunarInfo[i-1900]&(0x10000>>j))?30:29);if(isLeap&&j===leap+1)isLeap=false;else if(leap>0&&j===leap+1&&!isLeap){isLeap=true;--j;}offset-=md;}if(offset<0){offset+=md;--j;}if(j<1)j=1;if(j>12)j=12;return {m:j,d:Math.floor(offset)+1};}
function getMansion(date){const b=new Date(1900,0,31);const diff=Math.floor((date-b)/86400000);return twentyEightMansions[(diff%28+28)%28];}
function isAuspiciousDay(date) { const yb=getYellowBlackDay(date), man=getMansion(date), goodYb=["除","危","定","执","成","开"], goodMan=["角","房","尾","箕","斗","室","壁","娄","胃","毕","参","井","张","轸"];
return goodYb.includes(yb) && goodMan.includes(man); }
function getTraditionalYiJi(date) { const sb=getStemBranchDay(date), yb=getYellowBlackDay(date), isAus=isAuspiciousDay(date); let yi=[],ji=[], stem=sb[0]; if(["甲","乙"].includes(stem)){yi.push("祭祀","祈福","入学","栽种");ji.push("动土","开市","破屋")}else if(["丙","丁"].includes(stem)){yi.push("嫁娶","开市","出行");ji.push("祭祀","动土","安葬")}else if(["戊","己"].includes(stem)){yi.push("修造","动土","入宅");ji.push("开市","嫁娶","出行")}else if(["庚","辛"].includes(stem)){yi.push("求医","诉讼","交易");ji.push("祈福","祭祀","安床")}else{yi.push("出行","移徙","纳财");ji.push("修造","动土","开仓")} const ybMap={"建":[["祭祀","祈福"],["嫁娶","开市"]],"除":[["治病","扫舍"],["出行","诉讼"]],"满":[["祭祀","开市"],["嫁娶","安葬"]],"平":[["修造","安床"],["开市","交易"]],"定":[["嫁娶","订盟"],["词讼","开渠"]],"执":[["捕捉","破土"],["嫁娶","移徙"]],"破":[["破屋","坏垣"],["嫁娶","开市"]],"危":[["安床","入宅"],["破土","开渠"]],"成":[["嫁娶","开市"],["造桥","安床"]],"收":[["纳财","交易"],["开市","安葬"]],"开":[["开市","交易"],["破土","安葬"]],"闭":[["筑堤","补垣"],["开市","出行"]]};
if(ybMap[yb]){yi.push(...ybMap[yb][0]);ji.push(...ybMap[yb][1])} if(isAus)yi.push("嫁娶","开市","入宅");else ji.push("嫁娶","开市","出行"); return {yi:[...new Set(yi)].slice(0,6),ji:[...new Set(ji)].slice(0,6)} }
function getYiJiSimple(d,t){const r=getTraditionalYiJi(d);return t===0?r.yi:r.ji;}
function getWeekOfYear(d){const D=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate()));const dayNum=D.getUTCDay()||7;D.setUTCDate(D.getUTCDate()+4-dayNum);const yStart=new Date(Date.UTC(D.getUTCFullYear(),0,1));return Math.ceil((((D-yStart)/86400000)+1)/7);}
function getDayOfYear(d){return Math.floor((d-new Date(d.getFullYear(),0,0))/1000/60/60/24);}
function pad(n){return n<10?"0"+n:n;}
