const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript'),assert=require('node:assert/strict');
const cache={};
function load(file){file=path.resolve(file);if(cache[file])return cache[file];const out={};cache[file]=out;
  const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  vm.runInNewContext(code,{exports:out,Date,URL,require:name=>name==='expo-notifications'?{setNotificationHandler:()=>{}}:name==='react-native'?{Platform:{OS:'android'}}:load(path.resolve(path.dirname(file),name+'.ts'))});return out;
}
const parser=load('src/api/parsers.ts'),schedule=load('src/api/schedule.ts'),reminder=load('src/pet/reminders.ts'),lines=load('src/pet/lines.ts'),diff=load('src/pet/diff.ts');
let count=0;const test=(name,fn)=>{fn();count++;console.log('PASS '+name);};
const raw={currentWeek:1,weekIndices:Array.from({length:26},(_,i)=>i+1),lessons:[
  {id:1,course:{nameZh:'测试课程 A'},semester:{id:361,nameZh:'2026-2027-1',startDate:'2026-08-30',endDate:'2027-02-27',weekStartOnSunday:true},scheduleText:{dateTimePlaceText:{textZh:'1~5,7~8周 周一 第一节~第二节 草堂校区 测试楼; 6周 周六 第一节~第二节 草堂校区 测试楼'}}},
  {id:2,course:{nameZh:'测试课程 B'},scheduleText:{dateTimePlaceText:{textZh:'6周 周六 第七节~第十节 草堂校区 实训中心'}}},
]};
const table=parser.parseCourseTableJson(JSON.stringify(raw));
test('China Saturday in week 1 excludes week 6 lessons',()=>assert.equal(schedule.todaySchedule(table,'2026-09-05').lessons.length,0));
test('week 6 Saturday includes exactly the two arranged lessons',()=>assert.equal(schedule.todaySchedule(table,'2026-10-10').lessons.length,2));
test('Monday has one matching lesson',()=>assert.equal(schedule.todaySchedule(table,'2026-09-07').lessons.length,1));
test('Sunday starts the new school week',()=>assert.equal(schedule.weekForDate(table,'2026-09-06'),2));
test('Saturday stays in preceding school week',()=>assert.equal(schedule.weekForDate(table,'2026-09-05'),1));
test('next day with a course is Monday',()=>assert.equal(schedule.nextCourseDay(table,'2026-09-05').date,'2026-09-07'));
test('missing schedule is flagged instead of silently declared empty',()=>assert.equal(schedule.todaySchedule({...table,lessons:[{id:9,weekText:''}]},'2026-09-05').unparsed.length,1));
test('full width range accepted',()=>assert.equal(parser.inWeek('1～8周',6),true));
test('odd weeks filtered',()=>{assert.equal(parser.inWeek('1-8周(单)',3),true);assert.equal(parser.inWeek('1-8周(单)',4),false);});
test('future only week range excluded',()=>assert.equal(parser.inWeek('6周',1),false));
test('campus extracted',()=>assert.equal(table.lessons[0].campus,'草堂'));
test('official Caotang 08:30 schedules a 08:20 notice',()=>{const notices=reminder.courseReminders(table,'',Date.parse('2026-09-06T10:00:00+08:00'));assert.equal(notices[0].at,Date.parse('2026-09-07T08:20:00+08:00'));});
test('manual time overrides official time',()=>{const n=reminder.courseReminders(table,'1=09:00',Date.parse('2026-09-06T10:00:00+08:00'));assert.equal(n[0].at,Date.parse('2026-09-07T08:50:00+08:00'));});
test('unknown campus does not invent clock time',()=>assert.equal(reminder.courseReminders({...table,lessons:table.lessons.map(l=>({...l,campus:undefined}))},'',Date.parse('2026-09-06T10:00:00+08:00')).length,0));
test('malformed class times rejected',()=>assert.throws(()=>reminder.parseClassTimes('1=25:99')));
test('duplicate class units rejected',()=>assert.throws(()=>reminder.parseClassTimes('1=08:00;1=09:00')));
test('baseline does not alert about all existing grades',()=>assert.equal(diff.changedKeys(null,{a:'90'}).length,0));
test('unchanged records do not repeat notifications',()=>assert.equal(diff.changedKeys({a:'90'},{a:'90'}).length,0));
test('new and changed grades detected, removals not new',()=>assert.equal(diff.changedKeys({a:'90',c:'80'},{a:'91',b:'80'}).length,2));
test('at least 50 unique default lines',()=>assert.ok(new Set(Object.values(lines.PET_LINES).flat()).size>=50));
test('both tones resolve class placeholders',()=>{for(const tone of [1,2])for(let i=0;i<10;i++)assert.ok(!lines.petLine('class',tone,i,{course:'测试',place:'教室'}).includes('{'));});
console.log(`${count} campus tests passed`);
