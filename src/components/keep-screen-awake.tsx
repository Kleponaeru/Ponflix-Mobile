import { useKeepAwake } from 'expo-keep-awake';

/** Keep the device screen awake while this component is mounted. */
export function KeepScreenAwake() {
  useKeepAwake();
  return null;
}
