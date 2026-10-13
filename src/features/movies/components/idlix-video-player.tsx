import { useVideoPlayer, VideoView, type SubtitleTrack, type VideoTrack } from 'expo-video';
import { useEvent } from 'expo';
import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { KeepScreenAwake } from '@/components/keep-screen-awake';
import { PonflixTheme } from '@/constants/theme';
import type { IdlixSubtitleSource } from '@/features/movies/api/idlix-service';

interface SubtitleCue {
  start: number;
  end: number;
  text: string;
}

function parseSubtitleTime(value: string): number {
  const normalized = value.trim().replace(',', '.');
  const parts = normalized.split(':');
  const seconds = Number(parts.pop());
  const minutes = Number(parts.pop() || 0);
  const hours = Number(parts.pop() || 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function parseSubtitleCues(content: string): SubtitleCue[] {
  const lines = content.replace(/^\uFEFF/, '').replace(/\r/g, '').split('\n');
  const cues: SubtitleCue[] = [];
  const timing = /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s+-->\s+((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;
  for (let index = 0; index < lines.length; index += 1) {
    const match = timing.exec(lines[index]);
    if (!match) continue;
    const textLines: string[] = [];
    for (index += 1; index < lines.length && lines[index].trim(); index += 1) textLines.push(lines[index]);
    const text = textLines.join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#39;/gi, "'")
      .trim();
    if (text) cues.push({ start: parseSubtitleTime(match[1]), end: parseSubtitleTime(match[2]), text });
  }
  return cues;
}

export function IdlixVideoPlayer({ uri, headers, title, subtitleSources = [] }: {
  uri: string;
  headers: Record<string, string>;
  title: string;
  subtitleSources?: IdlixSubtitleSource[];
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [selectedExternalSubtitle, setSelectedExternalSubtitle] = useState<IdlixSubtitleSource | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleTime, setSubtitleTime] = useState(0);
  const [subtitleError, setSubtitleError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const player = useVideoPlayer({
    uri,
    contentType: /\.m3u8(?:$|[?#])/i.test(uri) ? 'hls' : 'auto',
    headers,
    metadata: { title },
  }, (videoPlayer) => {
    videoPlayer.timeUpdateEventInterval = 0.25;
    videoPlayer.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const qualityTracks = Array.from(new Map(videoTracks.filter((track) => track.url && track.size.height > 0).map((track) => [track.size.height, track])).values())
    .sort((first, second) => second.size.height - first.size.height);

  useEffect(() => {
    const updateTracks = (tracks: SubtitleTrack[]) => setSubtitleTracks(tracks);
    const updateVideoTracks = (tracks: VideoTrack[]) => setVideoTracks((current) => current.length ? current : tracks);
    const tracksSubscription = player.addListener('availableSubtitleTracksChange', (event) => updateTracks(event.availableSubtitleTracks));
    const sourceSubscription = player.addListener('sourceLoad', (event) => updateTracks(event.availableSubtitleTracks));
    const videoTracksSubscription = player.addListener('sourceLoad', (event) => updateVideoTracks(event.availableVideoTracks));
    const availableVideoTracksSubscription = player.addListener('videoTrackChange', () => updateVideoTracks(player.availableVideoTracks));
    const subtitleSubscription = player.addListener('subtitleTrackChange', (event) => setSelectedSubtitle(event.subtitleTrack ?? null));
    const timeSubscription = player.addListener('timeUpdate', (event) => setSubtitleTime(event.currentTime));
    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setLoading(false);
        updateTracks(player.availableSubtitleTracks);
        updateVideoTracks(player.availableVideoTracks);
      }
      if (event.status === 'error') {
        setLoading(false);
        setError(event.error?.message || 'The video source failed to play.');
      }
    });
    return () => {
      subscription.remove();
      sourceSubscription.remove();
      tracksSubscription.remove();
      videoTracksSubscription.remove();
      availableVideoTracksSubscription.remove();
      subtitleSubscription.remove();
      timeSubscription.remove();
    };
  }, [player]);

  useEffect(() => {
    if (!selectedExternalSubtitle) {
      setSubtitleCues([]);
      setSubtitleError('');
      return;
    }
    const controller = new AbortController();
    setSubtitleCues([]);
    setSubtitleError('');
    fetch(selectedExternalSubtitle.uri, { headers, signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Subtitle request failed.');
        const text = await response.text();
        const cues = parseSubtitleCues(text);
        if (!cues.length) throw new Error('Subtitle file had no readable captions.');
        return cues;
      })
      .then(setSubtitleCues)
      .catch(() => {
        if (!controller.signal.aborted) setSubtitleError('Could not load this subtitle track.');
      });
    return () => controller.abort();
  }, [headers, selectedExternalSubtitle]);

  const chooseSubtitle = (track: SubtitleTrack | null) => {
    // expo-video exposes subtitle selection as a mutable player property.
    // eslint-disable-next-line react-hooks/immutability
    player.subtitleTrack = track;
    setSelectedSubtitle(track);
    setSelectedExternalSubtitle(null);
    setShowSettings(false);
  };

  const chooseExternalSubtitle = (source: IdlixSubtitleSource | null) => {
    // External captions are drawn by Ponflix over the video; clear any native track first.
    // eslint-disable-next-line react-hooks/immutability
    player.subtitleTrack = null;
    setSelectedSubtitle(null);
    setSelectedExternalSubtitle(source);
    setShowSettings(false);
  };

  const chooseQuality = async (track: VideoTrack | null) => {
    const sourceUri = track?.url || uri;
    if (!sourceUri) return;
    const resumeAt = player.currentTime;
    const wasPlaying = player.playing;
    setLoading(true);
    setError('');
    setShowSettings(false);
    try {
      await player.replaceAsync({ uri: sourceUri, headers, contentType: 'hls' });
      // expo-video exposes seeking as a mutable player property.
      // eslint-disable-next-line react-hooks/immutability
      player.currentTime = resumeAt;
      if (wasPlaying) player.play();
      setSelectedQuality(track ? `${track.size.height}p` : 'Auto');
    } catch {
      setError('Could not change video quality.');
    }
  };

  return (
    <View style={styles.container}>
      {isPlaying ? <KeepScreenAwake /> : null}
      <View style={styles.videoFrame}>
        <VideoView
          player={player}
          style={styles.video}
          nativeControls
          contentFit="contain"
          surfaceType="textureView"
          fullscreenOptions={{ enable: true, orientation: 'default' }}
        />
        {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={PonflixTheme.colors.accent} size="large" /></View> : null}
        {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
        {selectedExternalSubtitle && !subtitleError ? (() => {
          const cue = subtitleCues.find((item) => subtitleTime >= item.start && subtitleTime <= item.end);
          return cue ? <View pointerEvents="none" style={styles.subtitleBox}><Text style={styles.subtitleText}>{cue.text}</Text></View> : null;
        })() : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Player settings: resolution and subtitles"
          accessibilityState={{ expanded: showSettings }}
          onPress={() => setShowSettings((visible) => !visible)}
          style={styles.settingsButton}
        >
          <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={19} tintColor="#FFF" />
        </Pressable>
        {showSettings ? (
          <View style={styles.settingsPanel}>
            <Text style={styles.settingsTitle}>Resolution</Text>
            <Pressable onPress={() => chooseQuality(null)} style={[styles.settingsOption, selectedQuality === 'Auto' && styles.settingsOptionSelected]}>
              <Text style={[styles.settingsOptionText, selectedQuality === 'Auto' && styles.settingsOptionTextSelected]}>Auto</Text>
            </Pressable>
            {qualityTracks.length ? qualityTracks.map((track, index) => {
              const label = `${track.size.height}p`;
              const selected = selectedQuality === label;
              return (
                <Pressable key={`${track.id}-${index}`} onPress={() => chooseQuality(track)} style={[styles.settingsOption, selected && styles.settingsOptionSelected]}>
                  <Text style={[styles.settingsOptionText, selected && styles.settingsOptionTextSelected]}>{label}</Text>
                </Pressable>
              );
            }) : <Text style={styles.settingsHint}>This source has no alternate quality tracks.</Text>}

            <Text style={styles.settingsTitle}>Subtitles</Text>
            {subtitleTracks.length || subtitleSources.length ? (
              <>
                <Pressable onPress={() => chooseSubtitle(null)} style={[styles.settingsOption, !selectedSubtitle && !selectedExternalSubtitle && styles.settingsOptionSelected]}>
                  <Text style={[styles.settingsOptionText, !selectedSubtitle && !selectedExternalSubtitle && styles.settingsOptionTextSelected]}>Off</Text>
                </Pressable>
                {subtitleTracks.map((track, index) => {
                  const selected = selectedSubtitle?.id === track.id && !selectedExternalSubtitle;
                  const label = track.label || track.language || track.name || `Subtitle ${index + 1}`;
                  return (
                    <Pressable key={`${track.id || track.language || label}-${index}`} onPress={() => chooseSubtitle(track)} style={[styles.settingsOption, selected && styles.settingsOptionSelected]}>
                      <Text numberOfLines={1} style={[styles.settingsOptionText, selected && styles.settingsOptionTextSelected]}>{label}</Text>
                    </Pressable>
                  );
                })}
                {subtitleSources.map((source, index) => {
                  const selected = selectedExternalSubtitle?.uri === source.uri;
                  return (
                    <Pressable key={`${source.uri}-${index}`} onPress={() => chooseExternalSubtitle(source)} style={[styles.settingsOption, selected && styles.settingsOptionSelected]}>
                      <Text numberOfLines={1} style={[styles.settingsOptionText, selected && styles.settingsOptionTextSelected]}>{source.label}</Text>
                    </Pressable>
                  );
                })}
                {subtitleError ? <Text style={styles.settingsHint}>{subtitleError}</Text> : null}
              </>
            ) : <Text style={styles.settingsHint}>No subtitles available in this source.</Text>}
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#000' },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  video: { flex: 1, backgroundColor: '#000' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  error: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.84)' },
  errorText: { color: '#FFF', textAlign: 'center', fontFamily: PonflixTheme.fonts.regular, fontSize: 12 },
  settingsButton: { position: 'absolute', zIndex: 6, top: 12, right: 12, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.7)' },
  settingsPanel: { position: 'absolute', zIndex: 5, top: 56, right: 12, width: 210, maxHeight: '82%', padding: 8, borderRadius: 10, backgroundColor: 'rgba(18,18,18,0.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  settingsTitle: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 11, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  settingsOption: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 6 },
  settingsOptionSelected: { backgroundColor: 'rgba(229,9,20,0.2)' },
  settingsOptionText: { color: 'rgba(255,255,255,0.78)', fontFamily: PonflixTheme.fonts.medium, fontSize: 10 },
  settingsOptionTextSelected: { color: PonflixTheme.colors.accentSoft, fontFamily: PonflixTheme.fonts.bold },
  settingsHint: { color: 'rgba(255,255,255,0.42)', fontFamily: PonflixTheme.fonts.regular, fontSize: 9, paddingHorizontal: 8, paddingVertical: 5 },
  subtitleBox: { position: 'absolute', left: 14, right: 14, bottom: 48, alignItems: 'center' },
  subtitleText: { overflow: 'hidden', color: '#FFF', backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 4, textAlign: 'center', fontFamily: PonflixTheme.fonts.semibold, fontSize: 14, lineHeight: 19 },
});
