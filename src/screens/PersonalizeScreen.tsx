import React, { useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { THEMES, useAppearance } from '../appearance';
import { GlassRoot, GlassSurface } from '../components/Glass';
import { MotionTouchableOpacity as Button } from '../components/MotionTouchableOpacity';
import { requestReminders, cancelClassReminders, parseClassTimes } from '../pet/reminders';

export function PersonalizeScreen({ onClose }: { onClose: () => void }) {
  const { preferences: p, theme, update } = useAppearance();
  const c=theme.colors;
  const [busy,setBusy]=useState(false);
  const [times,setTimes]=useState(p.classTimes);
  const title={color:c.text,fontSize:19,fontWeight:'800' as const,marginBottom:10};
  const body={color:c.textSecondary,fontSize:12,lineHeight:19};
  const button={backgroundColor:c.primarySoft,borderRadius:15,padding:13,marginTop:10};
  const pick=async()=>{setBusy(true);try {
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:['images'],quality:0.8,allowsEditing:false});
    if(result.canceled)return;
    const asset=result.assets[0];
    if ((asset.fileSize||0)>20*1024*1024) throw new Error('请选择小于 20 MB 的图片。');
    const dir=FileSystem.documentDirectory+'wallpapers/';
    await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
    const uri=dir+Date.now()+'.jpg';
    await FileSystem.copyAsync({from:asset.uri,to:uri});
    update({wallpaper:uri});
  } catch(e){Alert.alert('壁纸未更换',String((e as Error).message));} finally{setBusy(false);}};
  return <Modal visible animationType="slide" onRequestClose={onClose}><GlassRoot><SafeAreaView style={{flex:1}}>
    <View style={{padding:16,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}}><Text style={title}>我的校园风格</Text><Button accessibilityLabel="关闭个性化设置" onPress={onClose}><Text style={{color:c.primary,fontWeight:'700',padding:8}}>完成</Text></Button></View>
    <ScrollView contentContainerStyle={{padding:16,gap:18,paddingBottom:48}}>
      <Text style={body}>不改变原有布局。背景、玻璃卡片、文字、按钮与课表配色一起切换。</Text>
      {THEMES.map(t=><Button key={t.id} accessibilityRole="radio" accessibilityState={{checked:p.theme===t.id}} onPress={()=>update({theme:t.id})}>
        <LinearGradient colors={t.gradient} style={{padding:19,borderRadius:22,borderWidth:p.theme===t.id?2:1,borderColor:p.theme===t.id?t.colors.primary:'white',flexDirection:'row',alignItems:'center',gap:16}}>
          <View style={{width:42,height:42,borderRadius:21,backgroundColor:t.colors.primarySoft,borderWidth:6,borderColor:t.colors.primary}}/>
          <View style={{flex:1}}><Text style={{color:t.colors.text,fontSize:18,fontWeight:'800'}}>{t.name}</Text><Text style={{color:t.colors.textSecondary,marginTop:4,fontSize:12}}>{t.detail}</Text></View>
          <Text style={{color:t.colors.primary,fontSize:19}}>{p.theme===t.id?'✓':''}</Text>
        </LinearGradient>
      </Button>)}
      <GlassSurface style={{padding:18}}><Text style={title}>自己的风景</Text><Text style={body}>照片只保存在本机，不上传服务器。壁纸与主题可以搭配使用，文字仍保留清晰的玻璃底色。</Text>
        <Button disabled={busy} style={button} onPress={pick}><Text style={{color:c.primaryDark,fontWeight:'700'}}>{busy?'正在准备壁纸…':'从手机相册选择壁纸'}</Text></Button>
        {!!p.wallpaper&&<Button style={button} onPress={()=>update({wallpaper:null})}><Text style={{color:c.primaryDark}}>恢复主题背景</Text></Button>}
        <Text style={[body,{marginTop:16}]}>背景模糊程度</Text><View style={{flexDirection:'row',gap:8,marginTop:8}}>{[0,12,24,40].map(n=><Button key={n} onPress={()=>update({blur:n})} style={{flex:1,padding:12,borderRadius:12,backgroundColor:p.blur===n?c.primary:c.primarySoft}}><Text style={{textAlign:'center',color:p.blur===n?'white':c.text}}>{n===0?'清晰':n===12?'轻柔':n===24?'柔雾':'朦胧'}</Text></Button>)}</View>
      </GlassSurface>
      <GlassSurface style={{padding:18}}><Text style={title}>橙橙 · 校园小球</Text>
        {(['pet','greeting'] as const).map(key=><View key={key} style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:9}}><Text style={{color:c.text}}>{key==='pet'?'显示橙黄色小球':'每日问候'}</Text><Switch value={p[key]} onValueChange={v=>update({[key]:v})} trackColor={{true:c.primary}} /></View>)}
        <Text style={body}>60 句默认文案。轻触弹跳、呼吸、眨眼；不使用高强度催促或责骂。</Text>
        <View style={{flexDirection:'row',gap:10}}>{([1,2] as const).map(t=><Button key={t} style={[button,{flex:1,backgroundColor:p.tone===t?c.primary:c.primarySoft}]} onPress={()=>update({tone:t})}><Text style={{color:p.tone===t?'white':c.text}}>{t===1?'一档 · 温柔陪伴':'二档 · 轻快鼓励'}</Text></Button>)}</View>
      </GlassSurface>
      <GlassSurface style={{padding:18}}><Text style={title}>提醒与作息</Text>
        <Text style={body}>应用打开时每 5 分钟检查成绩和教务通知，返回应用时补查。首次同步只建立基线，不把历史记录当成新消息。关闭应用后不保证成绩、公告实时送达。</Text>
        <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',paddingVertical:10}}><Text style={{color:c.text}}>允许手机通知</Text><Switch disabled={busy} value={p.reminders} onValueChange={async v=>{setBusy(true);try{if(!v){await cancelClassReminders();update({reminders:false});}else if(await requestReminders()){update({reminders:true});}else Alert.alert('通知未开启','可以在手机系统设置中允许教务通发送通知。');}catch(e){Alert.alert('设置失败',String(e));}finally{setBusy(false);}}} trackColor={{true:c.primary}} /></View>
        <Text style={[body,{marginTop:8}]}>已接入教务处 2026–2027 学年两校区作息：按课程校区选择时间，雁塔校区自动区分夏冬作息。提前 10 分钟提醒。校区未识别或新学年作息未核实时，不猜测时间；可在下方手动覆盖指定节次。</Text>
        <Button onPress={()=>Linking.openURL('https://jwc.xauat.edu.cn/info/1101/36153.htm')}><Text style={{color:c.primary,marginTop:10}}>查看学校作息原文 ›</Text></Button>
        <TextInput accessibilityLabel="各节上课时间" value={times} onChangeText={setTimes} multiline autoCapitalize="none" placeholder="节次=HH:mm;节次=HH:mm" placeholderTextColor={c.textSecondary} style={{minHeight:80,padding:12,marginTop:12,backgroundColor:c.surface,borderRadius:12,color:c.text,borderWidth:1,borderColor:c.border}}/>
        <Button style={button} onPress={()=>{try {parseClassTimes(times);update({classTimes:times});Alert.alert('作息已保存','自定义时间优先，未填写的节次使用已核实的学校作息；留空可恢复自动作息。');}catch(e){Alert.alert('请检查时间',String((e as Error).message));}}}><Text style={{color:c.primaryDark,fontWeight:'700'}}>保存作息时间</Text></Button>
        <Text style={[body,{marginTop:12}]}>本地课程通知按已同步课表预约未来 7 天；系统省电、权限和临时调课可能影响提醒，请以学校通知为准。</Text>
      </GlassSurface>
    </ScrollView>
  </SafeAreaView></GlassRoot></Modal>;
}
