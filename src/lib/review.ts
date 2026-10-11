// Asks the store for its rating card. The store decides whether the card shows and tells the app
// nothing either way, so true means only that the store was asked. The web build has no store and
// answers true, so the gate can walk the days that lead to it.
import * as StoreReview from 'expo-store-review'
import { Platform } from 'react-native'

export async function askForRating (): Promise<boolean> {
  if (Platform.OS === 'web') return true
  try {
    if (!(await StoreReview.isAvailableAsync())) return false
    await StoreReview.requestReview()
    return true
  } catch { return false }
}
