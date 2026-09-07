import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { lessonsForDay, weekForDate } from '../api/schedule';
import { schoolDateKey } from '../api/semester';
import type { CourseTableData } from '../types';

Notifications.setNotificationHandler({ handleNotification: async () => ({ shouldShowBanner:true,shouldShowList:true,shouldPlaySound:false,shouldSetBadge:false }) });
export async function requestReminders() {
  if(Platform.OS==='android') await Notifications.setNotificationChannelAsync('campus',{name:'校园轻提醒',importance:Notifications.AndroidImportance.DEFAULT});
  return (await Notifications.requestPermissionsAsync()).granted;
}
export function parseClassTimes(text: string): Record<number,string> {
  const times:Record<number,string>={};
  if(!text.trim()) return times;
  for(const segment of text.split(/[;；\n]/).filter(s=>s.trim())) {
    const m=segment.trim().match(/^(\d{1,2})\s*=\s*([01]\d|2[0-3]):([0-5]\d)$/);
    if(!m || Number(m[1])<1 || Number(m[1])>16) throw new Error('请使用 1=08:00;3=10:00 的格式，节次为 1–16，时间为 24 小时制。');
    if(times[Number(m[1])]) throw new Error('同一节次只能填写一次。');
    times[Number(m[1])]=m[2]+':'+m[3];
  }
  return times;
}
export async function cancelClassReminders() {
  const pending=await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(pending.filter(n=>n.identifier.startsWith('xauat-course-')).map(n=>Notifications.cancelScheduledNotificationAsync(n.identifier)));
}
export function courseReminders(table:CourseTableData, text:string, now=Date.now()) {
  const times=parseClassTimes(text), today=schoolDateKey(new Date(now));
  const results:{id:string;at:number;course:string;place:string;date:string}[]=[];
  for(let offset=0;offset<7;offset++) {
    const date=new Date(Date.parse(today)+offset*86400000).toISOString().slice(0,10);
    const week=weekForDate(table,date); if(!week)continue;
    for(const l of lessonsForDay(table.lessons,week,new Date(date).getUTCDay()||7)) {
      const unit=l.startUnit||0;
      // Official 2026–2027 XAUAT timetable; never carry it silently into a new academic year.
      const official = table.semester?.nameZh.startsWith('2026-2027') && date <= '2027-08-31';
      const summer=Number(date.slice(5,7))>=5&&Number(date.slice(5,7))<=9;
      const caotang=['08:30','09:20','10:25','11:15','12:10','13:00','14:00','14:50','15:45','16:35','19:30','20:20'];
      const yanta=['08:00','09:00','10:10','11:10','','',...(summer?['14:30','15:30','16:30','17:30','20:00','21:00']:['14:00','15:00','16:00','17:00','19:30','20:30'])];
      const time=times[unit] || (official ? (l.campus==='草堂'?caotang:l.campus==='雁塔'?yanta:[])[unit-1] : '');if(!time)continue;
      const at=Date.parse(`${date}T${time}:00+08:00`)-10*60000;
      if(at<=now)continue;
      const id=`xauat-course-${table.semester?.id||table.semesterId}-${date}-${l.id}-${l.startUnit}`;
      if(!results.some(r=>r.id===id))results.push({id,at,course:l.nameZh,place:l.placeText,date});
    }
  }
  return results;
}
export async function scheduleCourses(table:CourseTableData,text:string) {
  if(!(await Notifications.getPermissionsAsync()).granted)return;
  const entries=courseReminders(table,text);
  const desired=new Set(entries.map(e=>e.id));
  const pending=await Notifications.getAllScheduledNotificationsAsync();
  // Reconcile only our requests; do not cancel other notification categories.
  for(const n of pending.filter(n=>n.identifier.startsWith('xauat-course-'))) {
    const item=entries.find(e=>e.id===n.identifier);
    if(!item || n.content.data?.at!==item.at || n.content.data?.place!==item.place) await Notifications.cancelScheduledNotificationAsync(n.identifier);
    else desired.delete(n.identifier);
  }
  for(const e of entries.filter(e=>desired.has(e.id))) await Notifications.scheduleNotificationAsync({identifier:e.id,content:{title:'橙橙 · 课前 10 分钟',body:`《${e.course}》快开始了，准备去${e.place||'课表中标注的教室'}吧。`,data:{target:'schedule',at:e.at,place:e.place}},trigger:{type:Notifications.SchedulableTriggerInputTypes.DATE,date:new Date(e.at),channelId:'campus'}});
}
export async function notifyUpdate(body:string,target:string) {
  if(!(await Notifications.getPermissionsAsync()).granted)return;
  await Notifications.scheduleNotificationAsync({content:{title:'橙橙 · 校园新消息',body,data:{target}},trigger:null});
}
