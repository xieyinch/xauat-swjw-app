import React from 'react';
import { Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchNoticeDetail } from '../api/noticeDetail';
import { FunctionShell } from '../components/FunctionShell';
import { ListContainer } from '../components/ListContainer';
import { useAsyncData } from '../hooks/useAsyncData';
import { colors, spacing } from '../theme';

interface Props {
  url: string;
  title: string;
  onClose: () => void;
}

function openDocument(url: string) {
  if (!/^https:\/\//i.test(url)) return;
  void Linking.openURL(url).catch(() => Alert.alert('无法打开文件'));
}

export function NoticeDetailScreen({ url, title, onClose }: Props) {
  const notice = useAsyncData({ loader: () => fetchNoticeDetail(url), deps: [url] });

  return (
    <FunctionShell title="教务公告" onClose={onClose}>
      <ListContainer loading={notice.loading || notice.refreshing} error={notice.error} onRetry={notice.retry}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text accessibilityRole="header" style={styles.title}>{title}</Text>
          {notice.data?.blocks.map((block, index) => {
            if (block.type === 'text') return <Text key={index} style={styles.text}>{block.text}</Text>;
            if (block.type === 'image') {
              return (
                <Pressable key={index} accessibilityRole="imagebutton" accessibilityLabel={block.alt} onPress={() => openDocument(block.url)}>
                  <Image style={styles.image} resizeMode="contain" source={{ uri: block.url }} />
                </Pressable>
              );
            }
            return (
              <ScrollView horizontal key={index}>
                <View>
                  {block.rows.map((row, rowIndex) => (
                    <View key={rowIndex} style={styles.row}>
                      {row.map((cell, colIndex) => <Text key={colIndex} style={styles.cell}>{cell}</Text>)}
                    </View>
                  ))}
                </View>
              </ScrollView>
            );
          })}
          {notice.data?.links.map(link => (
            <Text key={link.url} accessibilityRole="link" style={styles.link} onPress={() => openDocument(link.url)}>
              {link.title}
            </Text>
          ))}
        </ScrollView>
      </ListContainer>
      <Pressable accessibilityRole="link" style={styles.original} onPress={() => openDocument(url)}>
        <Text style={styles.link}>打开原公告</Text>
      </Pressable>
    </FunctionShell>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.md, gap: spacing.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '700' },
  text: { color: colors.text, fontSize: 15, lineHeight: 24 },
  image: { width: '100%', height: 220 },
  row: { flexDirection: 'row' },
  cell: { width: 140, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, color: colors.text },
  link: { color: colors.primary, fontSize: 15, lineHeight: 23 },
  original: { alignItems: 'center', padding: spacing.md },
});
