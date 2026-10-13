import { useVideoPlayer, VideoView, type AudioTrack, type SubtitleTrack, type VideoTrack } from 'expo-video';
import { useEvent } from 'expo';
import { SymbolView } from 'expo-symbols';
import { setVisibilityAsync } from 'expo-navigation-bar';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';

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

function formatPlaybackTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainder = total % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function IdlixVideoPlayer({ uri, headers, title, episodeLabel, contentType, subtitleSources = [] }: {
  uri: string;
  headers: Record<string, string>;
  title: string;
  episodeLabel?: string;
  contentType?: 'hls';
  subtitleSources?: IdlixSubtitleSource[];
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [subtitleTracks, setSubtitleTracks] = useState<SubtitleTrack[]>([]);
  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([]);
  const [videoTracks, setVideoTracks] = useState<VideoTrack[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<SubtitleTrack | null>(null);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<AudioTrack | null>(null);
  const [selectedExternalSubtitle, setSelectedExternalSubtitle] = useState<IdlixSubtitleSource | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [subtitleTime, setSubtitleTime] = useState(0);
  const [subtitleError, setSubtitleError] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsInteractive, setControlsInteractive] = useState(true);
  const [controlActivity, setControlActivity] = useState(0);
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [seekFeedback, setSeekFeedback] = useState<'backward' | 'forward' | null>(null);
  const [centerFeedback, setCenterFeedback] = useState<'play' | 'pause' | null>(null);
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekPreviewTime, setSeekPreviewTime] = useState(0);
  const [progressBarX, setProgressBarX] = useState(0);
  const progressTrackRef = useRef<View>(null);
  const lastLeftTap = useRef(0);
  const lastRightTap = useRef(0);
  const seekFeedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCenterTap = useRef(0);
  const defaultSubtitleApplied = useRef(false);
  const [selectedQuality, setSelectedQuality] = useState('Auto');
  const [playbackRate, setPlaybackRate] = useState(1);
  const player = useVideoPlayer({
    uri,
    contentType: contentType ?? (/\.m3u8(?:$|[?#])/i.test(uri) ? 'hls' : 'auto'),
    headers,
    metadata: { title },
  }, (videoPlayer) => {
    videoPlayer.timeUpdateEventInterval = 0.25;
    videoPlayer.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  const qualityTracks = Array.from(new Map(videoTracks.filter((track) => track.url && track.size.height > 0).map((track) => [track.size.height, track])).values())
    .sort((first, second) => second.size.height - first.size.height);

  const revealPlayerControls = () => {
    controlsOpacity.stopAnimation();
    controlsOpacity.setValue(1);
    setControlsInteractive(true);
    setControlActivity((value) => value + 1);
  };

  useEffect(() => {
    const updateTracks = (tracks: SubtitleTrack[]) => setSubtitleTracks(tracks);
    const updateAudioTracks = (tracks: AudioTrack[]) => setAudioTracks(tracks);
    const updateVideoTracks = (tracks: VideoTrack[]) => setVideoTracks((current) => current.length ? current : tracks);
    const tracksSubscription = player.addListener('availableSubtitleTracksChange', (event) => updateTracks(event.availableSubtitleTracks));
    const sourceSubscription = player.addListener('sourceLoad', (event) => updateTracks(event.availableSubtitleTracks));
    const videoTracksSubscription = player.addListener('sourceLoad', (event) => updateVideoTracks(event.availableVideoTracks));
    const availableVideoTracksSubscription = player.addListener('videoTrackChange', () => updateVideoTracks(player.availableVideoTracks));
    const subtitleSubscription = player.addListener('subtitleTrackChange', (event) => setSelectedSubtitle(event.subtitleTrack ?? null));
    const audioTracksSubscription = player.addListener('availableAudioTracksChange', (event) => updateAudioTracks(event.availableAudioTracks));
    const audioSubscription = player.addListener('audioTrackChange', (event) => setSelectedAudioTrack(event.audioTrack ?? null));
    const timeSubscription = player.addListener('timeUpdate', (event) => setSubtitleTime(event.currentTime));
    const subscription = player.addListener('statusChange', (event) => {
      if (event.status === 'readyToPlay') {
        setLoading(false);
        updateTracks(player.availableSubtitleTracks);
        updateAudioTracks(player.availableAudioTracks);
        updateVideoTracks(player.availableVideoTracks);
        setSelectedAudioTrack(player.audioTrack);
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
      audioTracksSubscription.remove();
      audioSubscription.remove();
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
    fetch(selectedExternalSubtitle.uri, {
      headers: { ...headers, ...(selectedExternalSubtitle.referer ? { Referer: selectedExternalSubtitle.referer } : {}) },
      signal: controller.signal,
    })
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

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    void setVisibilityAsync(isFullscreen ? 'hidden' : 'visible').catch(() => undefined);
    return () => {
      if (isFullscreen) void setVisibilityAsync('visible').catch(() => undefined);
    };
  }, [isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) {
      controlsOpacity.stopAnimation();
      controlsOpacity.setValue(1);
      setControlsInteractive(true);
      return;
    }
    if (!isPlaying || showSettings || showSubtitleMenu || isSeeking) {
      controlsOpacity.stopAnimation();
      controlsOpacity.setValue(1);
      setControlsInteractive(true);
      return;
    }
    const timer = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 260, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setControlsInteractive(false);
      });
    }, 3000);
    return () => {
      clearTimeout(timer);
      controlsOpacity.stopAnimation();
    };
  }, [controlActivity, controlsOpacity, isFullscreen, isPlaying, isSeeking, showSettings, showSubtitleMenu]);

  useEffect(() => () => {
    if (seekFeedbackTimer.current) clearTimeout(seekFeedbackTimer.current);
  }, []);

  useEffect(() => {
    defaultSubtitleApplied.current = false;
  }, [uri]);

  const handleSeekZonePress = (direction: 'backward' | 'forward') => {
    const now = Date.now();
    const lastTap = direction === 'backward' ? lastLeftTap : lastRightTap;
    if (now - lastTap.current <= 300) {
      lastTap.current = 0;
      player.seekBy(direction === 'backward' ? -5 : 5);
      setSeekFeedback(direction);
      if (seekFeedbackTimer.current) clearTimeout(seekFeedbackTimer.current);
      seekFeedbackTimer.current = setTimeout(() => { setSeekFeedback(null); setCenterFeedback(null); }, 650);
    } else {
      lastTap.current = now;
    }
  };

  const handleCenterTap = () => {
    revealPlayerControls();
    const now = Date.now();
    if (now - lastCenterTap.current <= 300) {
      lastCenterTap.current = 0;
      const nextAction = isPlaying ? 'pause' : 'play';
      if (nextAction === 'pause') player.pause();
      else player.play();
      setCenterFeedback(nextAction);
      if (seekFeedbackTimer.current) clearTimeout(seekFeedbackTimer.current);
      seekFeedbackTimer.current = setTimeout(() => { setCenterFeedback(null); setSeekFeedback(null); }, 650);
    } else {
      lastCenterTap.current = now;
    }
  };

  const chooseSubtitle = (track: SubtitleTrack | null) => {
    defaultSubtitleApplied.current = true;
    // expo-video exposes subtitle selection as a mutable player property.
    // eslint-disable-next-line react-hooks/immutability
    player.subtitleTrack = track;
    setSelectedSubtitle(track);
    setSelectedExternalSubtitle(null);
    setShowSettings(false);
    setShowSubtitleMenu(false);
  };

  const chooseAudioTrack = (track: AudioTrack | null) => {
    player.audioTrack = track;
    setSelectedAudioTrack(track);
  };

  const choosePlaybackRate = (rate: number) => {
    player.playbackRate = rate;
    setPlaybackRate(rate);
  };

  const chooseExternalSubtitle = (source: IdlixSubtitleSource | null) => {
    defaultSubtitleApplied.current = true;
    // External captions are drawn by Ponflix over the video; clear any native track first.
    // eslint-disable-next-line react-hooks/immutability
    player.subtitleTrack = null;
    setSelectedSubtitle(null);
    setSelectedExternalSubtitle(source);
    setShowSettings(false);
    setShowSubtitleMenu(false);
  };

  useEffect(() => {
    if (defaultSubtitleApplied.current) return;
    const isIndonesian = (value?: string | null) => /^(id|ind|in)(\b|[-_])|indonesian|bahasa indonesia/i.test(value || '');
    const externalIndonesian = subtitleSources.find((source) => isIndonesian(source.label));
    const nativeIndonesian = subtitleTracks.find((track) =>
      isIndonesian(track.label) || isIndonesian(track.language) || isIndonesian(track.name),
    );

    if (externalIndonesian) {
      defaultSubtitleApplied.current = true;
      // External captions are rendered by Ponflix over the video.
      // eslint-disable-next-line react-hooks/immutability
      player.subtitleTrack = null;
      setSelectedSubtitle(null);
      setSelectedExternalSubtitle(externalIndonesian);
      return;
    }
    if (nativeIndonesian) {
      defaultSubtitleApplied.current = true;
      // eslint-disable-next-line react-hooks/immutability
      player.subtitleTrack = nativeIndonesian;
      setSelectedSubtitle(nativeIndonesian);
      setSelectedExternalSubtitle(null);
      return;
    }
  }, [player, subtitleSources, subtitleTracks]);

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

  const seekToTouchPosition = (event: GestureResponderEvent) => {
    if (!progressBarWidth || !Number.isFinite(player.duration) || player.duration <= 0) return;
    const fraction = Math.max(0, Math.min(1, (event.nativeEvent.pageX - progressBarX) / progressBarWidth));
    const time = fraction * player.duration;
    setSeekPreviewTime(time);
    // eslint-disable-next-line react-hooks/immutability
    player.currentTime = time;
  };

  const displayTime = isSeeking ? seekPreviewTime : subtitleTime;
  const progressFraction = player.duration > 0 ? Math.max(0, Math.min(1, displayTime / player.duration)) : 0;

  const renderPlayerOverlays = (fullscreen: boolean) => (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Double tap left side to rewind 5 seconds"
        onPress={() => { revealPlayerControls(); handleSeekZonePress('backward'); }}
        style={styles.leftSeekZone}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Double tap right side to skip forward 5 seconds"
        onPress={() => { revealPlayerControls(); handleSeekZonePress('forward'); }}
        style={styles.rightSeekZone}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Double tap center to play or pause"
        onPress={handleCenterTap}
        style={styles.centerTapZone}
      />
      {seekFeedback ? (
        <View pointerEvents="none" style={[styles.seekFeedback, seekFeedback === 'backward' ? styles.seekFeedbackLeft : styles.seekFeedbackRight]}>
          <Text style={styles.seekFeedbackText}>{seekFeedback === 'backward' ? '−5 sec' : '+5 sec'}</Text>
        </View>
      ) : null}
      {centerFeedback ? (
        <View pointerEvents="none" style={styles.centerFeedback}>
          <SymbolView name={{ ios: centerFeedback === 'play' ? 'play.fill' : 'pause.fill', android: centerFeedback === 'play' ? 'play_arrow' : 'pause', web: centerFeedback === 'play' ? 'play_arrow' : 'pause' }} size={34} tintColor="#FFF" />
        </View>
      ) : null}
      {loading ? <View pointerEvents="none" style={styles.loading}><ActivityIndicator color={PonflixTheme.colors.accent} size="large" /></View> : null}
      {error ? <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View> : null}
      {fullscreen ? (
        <Animated.View pointerEvents="none" style={[styles.fullscreenHeading, { opacity: controlsOpacity }]}>
          <Text numberOfLines={1} style={styles.fullscreenTitle}>{title}</Text>
          {episodeLabel ? <Text numberOfLines={1} style={styles.fullscreenEpisode}>{episodeLabel}</Text> : null}
        </Animated.View>
      ) : null}
      {selectedExternalSubtitle && !subtitleError ? (() => {
        const cue = subtitleCues.find((item) => subtitleTime >= item.start && subtitleTime <= item.end);
        return cue ? (
          <View pointerEvents="none" style={[styles.subtitleBox, fullscreen && styles.fullscreenSubtitleBox]}>
            <Text style={[styles.subtitleText, fullscreen && styles.fullscreenSubtitleText]}>{cue.text}</Text>
          </View>
        ) : null;
      })() : null}
      <Animated.View onTouchStart={revealPlayerControls} pointerEvents={controlsInteractive ? 'auto' : 'none'} style={[styles.controlBar, { opacity: controlsOpacity }]}>
        <Pressable accessibilityRole="button" accessibilityLabel={isPlaying ? 'Pause' : 'Play'} onPress={() => isPlaying ? player.pause() : player.play()} style={styles.controlButton}>
          <SymbolView name={{ ios: isPlaying ? 'pause.fill' : 'play.fill', android: isPlaying ? 'pause' : 'play_arrow', web: isPlaying ? 'pause' : 'play_arrow' }} size={20} tintColor="#FFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Rewind 5 seconds" onPress={() => player.seekBy(-5)} style={styles.controlButton}>
          <SymbolView name={{ ios: 'gobackward.5', android: 'replay_5', web: 'replay_5' }} size={20} tintColor="#FFF" />
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Forward 5 seconds" onPress={() => player.seekBy(5)} style={styles.controlButton}>
          <SymbolView name={{ ios: 'goforward.5', android: 'forward_5', web: 'forward_5' }} size={20} tintColor="#FFF" />
        </Pressable>
        <Text style={styles.playbackTime}>{formatPlaybackTime(displayTime)} / {formatPlaybackTime(player.duration)}</Text>
        <View style={styles.controlSpacer} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Subtitles"
          accessibilityState={{ expanded: showSubtitleMenu, selected: Boolean(selectedSubtitle || selectedExternalSubtitle) }}
          onPress={() => { setShowSettings(false); setShowSubtitleMenu((visible) => !visible); }}
          style={styles.controlButton}
        >
          <SymbolView name={{ ios: 'captions.bubble', android: 'closed_caption', web: 'closed_caption' }} size={20} tintColor={selectedSubtitle || selectedExternalSubtitle ? PonflixTheme.colors.accentSoft : '#FFF'} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Player settings: resolution, audio, and playback speed"
          accessibilityState={{ expanded: showSettings }}
          onPress={() => { setShowSubtitleMenu(false); setShowSettings((visible) => !visible); }}
          style={styles.controlButton}
        >
          <SymbolView name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }} size={19} tintColor="#FFF" />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          onPress={() => { setShowSettings(false); setShowSubtitleMenu(false); setIsFullscreen(!fullscreen); }}
          style={styles.controlButton}
        >
          <SymbolView
            name={{ ios: fullscreen ? 'arrow.down.right.and.arrow.up.left' : 'arrow.up.left.and.arrow.down.right', android: fullscreen ? 'fullscreen_exit' : 'fullscreen', web: fullscreen ? 'fullscreen_exit' : 'fullscreen' }}
            size={19}
            tintColor="#FFF"
          />
        </Pressable>
      </Animated.View>
      <Animated.View
        ref={progressTrackRef}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Seek video"
        accessibilityHint="Tap or drag the timeline to seek through the video"
        pointerEvents={controlsInteractive ? 'auto' : 'none'}
        onTouchStart={revealPlayerControls}
        onLayout={(event) => {
          setProgressBarWidth(event.nativeEvent.layout.width);
          progressTrackRef.current?.measureInWindow((x) => setProgressBarX(x));
        }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => { revealPlayerControls(); setIsSeeking(true); seekToTouchPosition(event); }}
        onResponderMove={seekToTouchPosition}
        onResponderRelease={() => { setSubtitleTime(player.currentTime); setIsSeeking(false); }}
        onResponderTerminate={() => { setSubtitleTime(player.currentTime); setIsSeeking(false); }}
        style={[styles.progressTrack, { opacity: controlsOpacity }]}
      >
        <View style={styles.progressBackground} />
        <View style={[styles.progressFill, { width: `${progressFraction * 100}%` }]} />
        <View style={[styles.progressThumb, { left: `${progressFraction * 100}%` }]} />
      </Animated.View>
      {showSettings ? (
        <Animated.View onTouchStart={revealPlayerControls} pointerEvents={controlsInteractive ? 'auto' : 'none'} style={[styles.settingsPanel, { opacity: controlsOpacity }]}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Text style={styles.settingsTitle}>Playback speed</Text>
          <View style={styles.speedOptionsRow}>
            {[0.75, 1, 1.25, 1.5, 2].map((rate) => (
              <Pressable key={rate} onPress={() => choosePlaybackRate(rate)} style={[styles.speedOption, playbackRate === rate && styles.settingsOptionSelected]}>
                <Text style={[styles.settingsOptionText, playbackRate === rate && styles.settingsOptionTextSelected]}>{rate}x</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.settingsTitle}>Audio</Text>
          {audioTracks.length ? (
            <>
              <Pressable onPress={() => chooseAudioTrack(null)} style={[styles.settingsOption, !selectedAudioTrack && styles.settingsOptionSelected]}>
                <Text style={[styles.settingsOptionText, !selectedAudioTrack && styles.settingsOptionTextSelected]}>Auto</Text>
              </Pressable>
              {audioTracks.map((track, index) => {
                const selected = selectedAudioTrack?.id === track.id && selectedAudioTrack?.language === track.language;
                return (
                  <Pressable key={`${track.id || track.language}-${index}`} onPress={() => chooseAudioTrack(track)} style={[styles.settingsOption, selected && styles.settingsOptionSelected]}>
                    <Text numberOfLines={1} style={[styles.settingsOptionText, selected && styles.settingsOptionTextSelected]}>{track.label || track.language || track.name || `Audio ${index + 1}`}</Text>
                  </Pressable>
                );
              })}
            </>
          ) : <Text style={styles.settingsHint}>This source has no alternate audio tracks.</Text>}

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

          </ScrollView>
        </Animated.View>
      ) : null}
      {showSubtitleMenu ? (
        <Animated.View onTouchStart={revealPlayerControls} pointerEvents={controlsInteractive ? 'auto' : 'none'} style={[styles.settingsPanel, styles.subtitlePanel, { opacity: controlsOpacity }]}>
          <Text style={styles.settingsTitle}>Subtitles</Text>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
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
          </ScrollView>
        </Animated.View>
      ) : null}
    </>
  );

  return (
    <View style={styles.container}>
      {isPlaying ? <KeepScreenAwake /> : null}
      <StatusBar hidden={isFullscreen} />
      {!isFullscreen ? (
        <View style={styles.videoFrame}>
          <VideoView player={player} style={styles.video} nativeControls={false} contentFit="contain" surfaceType="textureView" fullscreenOptions={{ enable: false }} />
          {renderPlayerOverlays(false)}
        </View>
      ) : null}
      <Modal
        visible={isFullscreen}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        navigationBarTranslucent
        supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
        onRequestClose={() => setIsFullscreen(false)}
      >
        {isFullscreen ? (
          <View style={styles.fullscreenStage}>
            <StatusBar hidden />
            <VideoView player={player} style={styles.fullscreenVideo} nativeControls={false} contentFit="contain" surfaceType="textureView" fullscreenOptions={{ enable: false }} />
            {renderPlayerOverlays(true)}
          </View>
        ) : null}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', backgroundColor: '#000' },
  videoFrame: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000', position: 'relative' },
  video: { flex: 1, backgroundColor: '#000' },
  fullscreenStage: { flex: 1, backgroundColor: '#000' },
  fullscreenVideo: { flex: 1, backgroundColor: '#000' },
  fullscreenHeading: { position: 'absolute', zIndex: 6, top: 18, left: 18, right: 18, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 8, backgroundColor: 'transparent' },
  fullscreenTitle: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 15, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 5, textShadowOffset: { width: 0, height: 1 } },
  fullscreenEpisode: { marginTop: 3, color: 'rgba(255,255,255,0.9)', fontFamily: PonflixTheme.fonts.medium, fontSize: 11, textShadowColor: 'rgba(0,0,0,0.8)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  leftSeekZone: { position: 'absolute', zIndex: 4, left: 0, top: 0, bottom: 68, width: '35%' },
  rightSeekZone: { position: 'absolute', zIndex: 4, right: 0, top: 0, bottom: 68, width: '35%' },
  centerTapZone: { position: 'absolute', zIndex: 4, left: '35%', right: '35%', top: 0, bottom: 68 },
  seekFeedback: { position: 'absolute', zIndex: 5, top: '42%', minWidth: 58, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.68)', alignItems: 'center' },
  seekFeedbackLeft: { left: '14%' },
  seekFeedbackRight: { right: '14%' },
  seekFeedbackText: { color: '#FFF', fontFamily: PonflixTheme.fonts.semibold, fontSize: 14 },
  centerFeedback: { position: 'absolute', zIndex: 5, left: '50%', top: '50%', width: 62, height: 62, marginLeft: -31, marginTop: -31, borderRadius: 31, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.58)' },
  loading: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  error: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0,0,0,0.84)' },
  errorText: { color: '#FFF', textAlign: 'center', fontFamily: PonflixTheme.fonts.regular, fontSize: 12 },
  controlBar: { position: 'absolute', zIndex: 6, left: 0, right: 0, bottom: 0, minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, backgroundColor: 'rgba(0,0,0,0.82)' },
  controlButton: { width: 34, height: 44, alignItems: 'center', justifyContent: 'center' },
  controlSpacer: { flex: 1 },
  playbackTime: { color: '#FFF', fontFamily: PonflixTheme.fonts.medium, fontSize: 11, marginLeft: 5 },
  speedOptionsRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6, paddingVertical: 2 },
  speedOption: { minWidth: 34, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 6 },
  progressTrack: { position: 'absolute', zIndex: 7, left: 0, right: 0, bottom: 56, height: 22, justifyContent: 'center', overflow: 'visible' },
  progressBackground: { position: 'absolute', left: 0, right: 0, height: 3, backgroundColor: 'rgba(255,255,255,0.45)' },
  progressFill: { position: 'absolute', left: 0, height: 3, backgroundColor: PonflixTheme.colors.accent },
  progressThumb: { position: 'absolute', width: 14, height: 14, marginLeft: -7, borderRadius: 7, backgroundColor: '#FFF', elevation: 2 },
  settingsPanel: { position: 'absolute', zIndex: 8, right: 12, bottom: 68, width: 210, maxHeight: '82%', padding: 8, borderRadius: 10, backgroundColor: 'rgba(18,18,18,0.97)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  subtitlePanel: { width: 230, maxHeight: '70%' },
  settingsTitle: { color: '#FFF', fontFamily: PonflixTheme.fonts.bold, fontSize: 11, paddingHorizontal: 8, paddingTop: 6, paddingBottom: 4 },
  settingsOption: { minHeight: 32, justifyContent: 'center', paddingHorizontal: 9, borderRadius: 6 },
  settingsOptionSelected: { backgroundColor: 'rgba(229,9,20,0.2)' },
  settingsOptionText: { color: 'rgba(255,255,255,0.78)', fontFamily: PonflixTheme.fonts.medium, fontSize: 10 },
  settingsOptionTextSelected: { color: PonflixTheme.colors.accentSoft, fontFamily: PonflixTheme.fonts.bold },
  settingsHint: { color: 'rgba(255,255,255,0.42)', fontFamily: PonflixTheme.fonts.regular, fontSize: 9, paddingHorizontal: 8, paddingVertical: 5 },
  subtitleBox: { position: 'absolute', left: 14, right: 14, bottom: 80, alignItems: 'center' },
  fullscreenSubtitleBox: { bottom: 90 },
  subtitleText: { overflow: 'hidden', color: '#FFF', backgroundColor: 'rgba(0,0,0,0.78)', borderRadius: 4, paddingHorizontal: 10, paddingVertical: 5, textAlign: 'center', fontFamily: PonflixTheme.fonts.semibold, fontSize: 18, lineHeight: 24 },
  fullscreenSubtitleText: { fontSize: 22, lineHeight: 29 },
});
