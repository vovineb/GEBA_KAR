import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/** Connectivity state. Unknown reachability is treated as online. */
export function useIsOnline() {
  const [online, setOnline] = useState(true);
  useEffect(
    () =>
      NetInfo.addEventListener((s) => {
        setOnline(s.isConnected !== false && s.isInternetReachable !== false);
      }),
    [],
  );
  return online;
}
