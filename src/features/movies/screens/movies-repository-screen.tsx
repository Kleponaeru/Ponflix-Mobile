import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BrandHeader } from '@/components/brand-header';
import { PonflixTheme } from '@/constants/theme';
import {
  DEFAULT_CLOUDSTREAM_REPOSITORY,
  fetchCloudstreamRepository,
  type CloudstreamPlugin,
  type CloudstreamRepository,
} from '@/features/movies/api/cloudstream-repository-service';
import { getInstalledMovieProviders, IDLIX_PROVIDER_ID, setMovieProviderInstalled } from '@/features/movies/api/installed-movie-providers';

const { colors, fonts } = PonflixTheme;

export default function MoviesRepositoryScreen() {
  const [repositoryUrl, setRepositoryUrl] = useState(DEFAULT_CLOUDSTREAM_REPOSITORY);
  const [repository, setRepository] = useState<CloudstreamRepository | null>(null);
  const [plugins, setPlugins] = useState<CloudstreamPlugin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [installedProviders, setInstalledProviders] = useState<string[]>([]);
  const [installingId, setInstallingId] = useState('');

  useEffect(() => {
    getInstalledMovieProviders().then(setInstalledProviders).catch(() => {});
  }, []);

  const loadRepository = useCallback(async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    setLoaded(false);
    try {
      const result = await fetchCloudstreamRepository(repositoryUrl);
      setRepository(result.repository);
      setPlugins(result.plugins);
      setLoaded(true);
    } catch (reason) {
      setRepository(null);
      setPlugins([]);
      setError(reason instanceof Error ? reason.message : 'Could not load this repository.');
    } finally {
      setLoading(false);
    }
  }, [loading, repositoryUrl]);

  const installOrOpen = useCallback(async (plugin: CloudstreamPlugin) => {
    const providerId = plugin.internalName?.toLocaleLowerCase();
    if (providerId !== IDLIX_PROVIDER_ID || Platform.OS !== 'android') return;
    if (installedProviders.includes(providerId)) {
      router.push('/movies/idlix' as Href);
      return;
    }
    setInstallingId(providerId);
    setError('');
    try {
      const next = await setMovieProviderInstalled(providerId, true);
      setInstalledProviders(next);
    } catch {
      setError('Ponflix could not save the provider installation on this device.');
    } finally {
      setInstallingId('');
    }
  }, [installedProviders]);

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="light-content" backgroundColor={colors.background} />
      <SafeAreaView edges={['top']} style={styles.safeArea}>
        <BrandHeader />
        <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          <View style={styles.heading}>
            <Text style={styles.kicker}>CLOUDSTREAM CATALOG</Text>
            <Text style={styles.title}>Movies</Text>
            <Text style={styles.subtitle}>Add a CloudStream repository to view its available providers.</Text>
          </View>

          <Text style={styles.label}>Repository URL</Text>
          <View style={styles.inputRow}>
            <TextInput
              accessibilityLabel="CloudStream repository URL"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              onChangeText={setRepositoryUrl}
              onSubmitEditing={loadRepository}
              placeholder="https://example.com/repo.json"
              placeholderTextColor="rgba(255,255,255,0.36)"
              returnKeyType="go"
              selectTextOnFocus
              style={styles.input}
              value={repositoryUrl}
            />
          </View>
          <Pressable accessibilityRole="button" disabled={loading} onPress={loadRepository} style={({ pressed }) => [styles.loadButton, pressed && !loading && styles.buttonPressed, loading && styles.buttonDisabled]}>
            {loading ? <ActivityIndicator color="#FFF" size="small" /> : null}
            <Text style={styles.loadButtonText}>{loading ? 'Loading repository…' : 'Load repository'}</Text>
          </Pressable>

          {error ? (
            <View accessibilityRole="alert" style={styles.messageCard}>
              <Text style={styles.messageTitle}>Couldn’t load repository</Text>
              <Text style={styles.messageBody}>{error}</Text>
            </View>
          ) : null}

          {loaded && repository ? (
            <View style={styles.results}>
              <View style={styles.repoCard}>
                {repository.iconUrl ? <Image source={{ uri: repository.iconUrl }} contentFit="cover" style={styles.repoIcon} /> : <View style={[styles.repoIcon, styles.iconFallback]}><Text style={styles.iconLetter}>{repository.name?.slice(0, 1) || 'R'}</Text></View>}
                <View style={styles.repoCopy}>
                  <Text style={styles.repoName}>{repository.name}</Text>
                  <Text style={styles.repoDescription}>{repository.description || 'CloudStream plugin repository'}</Text>
                </View>
              </View>

              <View style={styles.sectionHeading}>
                <Text style={styles.sectionTitle}>Available providers</Text>
                <Text style={styles.count}>{plugins.length}</Text>
              </View>

              {plugins.length ? plugins.map((plugin, index) => {
                const providerId = plugin.internalName?.toLocaleLowerCase() || '';
                const supported = providerId === IDLIX_PROVIDER_ID && Platform.OS === 'android';
                const installed = Platform.OS === 'android' && installedProviders.includes(providerId);
                return (
                  <PluginCard
                    key={`${plugin.internalName || plugin.name}-${index}`}
                    plugin={plugin}
                    action={installingId === providerId ? 'Installing…' : installed ? 'Open' : providerId === IDLIX_PROVIDER_ID && Platform.OS !== 'android' ? 'Android only' : supported ? 'Install' : 'Unavailable'}
                    disabled={!supported || installingId === providerId}
                    onPress={() => installOrOpen(plugin)}
                  />
                );
              }) : (
                <View style={styles.messageCard}>
                  <Text style={styles.messageTitle}>No providers found</Text>
                  <Text style={styles.messageBody}>The repository loaded, but its plugin lists were empty or had an unsupported format.</Text>
                </View>
              )}

              <View style={styles.notice}>
                <Text style={styles.noticeTitle}>Catalog loaded</Text>
                <Text style={styles.noticeBody}>Install enables a Ponflix-compatible provider on this Android device. Idlix is the first supported provider. The downloaded CloudStream .cs3 files themselves still run only inside CloudStream.</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function PluginCard({ plugin, action, disabled, onPress }: { plugin: CloudstreamPlugin; action: string; disabled: boolean; onPress: () => void }) {
  const types = plugin.tvTypes?.join(' · ');
  const authors = plugin.authors?.join(', ');
  return (
    <View style={styles.pluginCard}>
      {plugin.iconUrl ? <Image source={{ uri: plugin.iconUrl }} contentFit="cover" style={styles.pluginIcon} /> : <View style={[styles.pluginIcon, styles.iconFallback]}><Text style={styles.iconLetter}>{plugin.name.slice(0, 1)}</Text></View>}
      <View style={styles.pluginCopy}>
        <View style={styles.pluginTitleRow}>
          <Text numberOfLines={1} style={styles.pluginName}>{plugin.name}</Text>
          <View style={[styles.statusBadge, plugin.status === 1 ? styles.statusActive : styles.statusOther]}>
            <Text style={styles.statusText}>{plugin.status === 1 ? 'Active' : 'Plugin'}</Text>
          </View>
        </View>
        <Text numberOfLines={2} style={styles.pluginDescription}>{plugin.description || 'CloudStream provider'}</Text>
        <Text numberOfLines={1} style={styles.pluginMeta}>{[types, authors, plugin.language?.toUpperCase()].filter(Boolean).join('  ·  ') || 'CloudStream extension'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.installButton, disabled && styles.installDisabled, pressed && !disabled && styles.buttonPressed]}>
        <Text style={styles.installButtonText}>{action}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 34 },
  heading: { paddingTop: 14, paddingBottom: 22 },
  kicker: { color: colors.accent, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 2 },
  title: { color: '#FFF', fontFamily: fonts.extraBold, fontSize: 30, lineHeight: 36, letterSpacing: -0.8, marginTop: 9 },
  subtitle: { color: 'rgba(255,255,255,0.55)', fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginTop: 6 },
  label: { color: 'rgba(255,255,255,0.76)', fontFamily: fonts.semibold, fontSize: 12, marginBottom: 8 },
  inputRow: { minHeight: 50, borderWidth: 1, borderColor: 'rgba(255,255,255,0.13)', borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.045)', paddingHorizontal: 13, justifyContent: 'center' },
  input: { color: '#FFF', fontFamily: fonts.regular, fontSize: 12, paddingVertical: 12 },
  loadButton: { minHeight: 46, marginTop: 10, borderRadius: 9, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 9 },
  buttonPressed: { opacity: 0.78 },
  buttonDisabled: { opacity: 0.7 },
  loadButtonText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 13 },
  results: { marginTop: 27 },
  repoCard: { minHeight: 76, padding: 13, borderRadius: 11, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 12 },
  repoIcon: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#24252A' },
  repoCopy: { flex: 1, gap: 4 },
  repoName: { color: '#FFF', fontFamily: fonts.bold, fontSize: 15 },
  repoDescription: { color: 'rgba(255,255,255,0.53)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 16 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 12 },
  sectionTitle: { color: '#F7F7F8', fontFamily: fonts.bold, fontSize: 17 },
  count: { color: 'rgba(255,255,255,0.44)', fontFamily: fonts.semibold, fontSize: 12 },
  pluginCard: { minHeight: 85, padding: 12, marginBottom: 9, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.065)', backgroundColor: 'rgba(255,255,255,0.035)', flexDirection: 'row', alignItems: 'center', gap: 12 },
  pluginIcon: { width: 46, height: 46, borderRadius: 10, backgroundColor: '#24252A' },
  iconFallback: { alignItems: 'center', justifyContent: 'center' },
  iconLetter: { color: colors.accentSoft, fontFamily: fonts.bold, fontSize: 18 },
  pluginCopy: { flex: 1, minWidth: 0, gap: 4 },
  pluginTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pluginName: { flex: 1, color: '#FFF', fontFamily: fonts.bold, fontSize: 14 },
  statusBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 10 },
  statusActive: { backgroundColor: 'rgba(55,170,110,0.17)' },
  statusOther: { backgroundColor: 'rgba(255,255,255,0.09)' },
  statusText: { color: 'rgba(255,255,255,0.78)', fontFamily: fonts.semibold, fontSize: 9 },
  pluginDescription: { color: 'rgba(255,255,255,0.62)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 15 },
  pluginMeta: { color: 'rgba(255,255,255,0.38)', fontFamily: fonts.medium, fontSize: 9, marginTop: 1 },
  installButton: { minWidth: 62, minHeight: 32, paddingHorizontal: 8, borderRadius: 7, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  installDisabled: { backgroundColor: 'rgba(255,255,255,0.08)' },
  installButtonText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 10 },
  messageCard: { padding: 15, marginTop: 18, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.045)' },
  messageTitle: { color: '#FFF', fontFamily: fonts.bold, fontSize: 13, marginBottom: 5 },
  messageBody: { color: 'rgba(255,255,255,0.57)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
  notice: { padding: 14, marginTop: 13, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(229,9,20,0.28)', backgroundColor: 'rgba(229,9,20,0.075)' },
  noticeTitle: { color: '#FF9298', fontFamily: fonts.bold, fontSize: 12, marginBottom: 5 },
  noticeBody: { color: 'rgba(255,255,255,0.63)', fontFamily: fonts.regular, fontSize: 11, lineHeight: 17 },
});
