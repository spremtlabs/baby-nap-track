// A newer Baby Nap Track on Google Play is offered in the app with Play's own update sheet, so a parent
// whose phone does not update apps by itself still gets the fixes. Android only; on an iPhone and
// on the web build it does nothing.
import * as InAppUpdates from 'expo-in-app-updates'
import { Platform } from 'react-native'

export async function offerUpdate () {
  if (__DEV__ || Platform.OS !== 'android') return
  try {
    const r = await InAppUpdates.checkForUpdate()
    if (r?.updateAvailable && r.flexibleAllowed) await InAppUpdates.startUpdate(false)
  } catch {}
}
