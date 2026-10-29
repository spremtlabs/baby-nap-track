// The reminder before the next window. One is booked at a time, and it is booked again every
// time the log changes or the app opens, so it always matches what the screen says. While a sleep
// runs, a quiet notice on the lock screen says when it started.
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'

let ready = false
const SLEEP = 'sleep'

async function setup () {
  if (ready || Platform.OS === 'web') return
  ready = true
  // The sleep notice goes up when the parent taps the button, so it never pops over the app.
  Notifications.setNotificationHandler({
    handleNotification: async (n) => {
      const quiet = n.request.identifier === SLEEP
      return { shouldShowBanner: !quiet, shouldShowList: true, shouldPlaySound: !quiet, shouldSetBadge: false }
    },
  })
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('naps', {
      name: 'Nap and bedtime reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#E29A39',
    })
    await Notifications.setNotificationChannelAsync('sleeping', {
      name: 'Sleep timer',
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: null,
      enableVibrate: false,
      showBadge: false,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    })
  }
}

export async function askToRemind () {
  if (Platform.OS === 'web') return false
  await setup()
  const now = await Notifications.getPermissionsAsync()
  if (now.granted) return true
  const asked = await Notifications.requestPermissionsAsync()
  return asked.granted
}

// `age` is the notice on the morning the wake windows move on to the next age, from 1.0.41. It is
// booked beside the reminder, because booking cancels everything booked before.
type Note = { at: number; title: string; body: string }
export async function book (next: Note | null, age: Note | null = null) {
  if (Platform.OS === 'web') return
  await setup()
  await Notifications.cancelAllScheduledNotificationsAsync()
  const due = [next, age].filter((x): x is Note => !!x && x.at >= Date.now() + 60 * 1000)
  if (!due.length) return
  const perm = await Notifications.getPermissionsAsync()
  if (!perm.granted) return
  for (const x of due) {
    await Notifications.scheduleNotificationAsync({
      content: { title: x.title, body: x.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(x.at), channelId: 'naps' },
    })
  }
}

// The notice for the sleep that is running, or none. It stays until the sleep ends, here or on a
// phone sharing the log. It is posted again only when its words change.
let shown: string | null | undefined
export async function showSleep (note: { title: string; body: string } | null) {
  if (Platform.OS === 'web') return
  const key = note ? `${note.title}|${note.body}` : null
  if (key === shown) return
  shown = key
  await setup()
  if (!note) { await Notifications.dismissNotificationAsync(SLEEP); return }
  const perm = await Notifications.getPermissionsAsync()
  if (!perm.granted) { shown = undefined; return }
  await Notifications.scheduleNotificationAsync({
    identifier: SLEEP,
    content: { title: note.title, body: note.body, sticky: true, autoDismiss: false, sound: false },
    trigger: Platform.OS === 'android' ? { channelId: 'sleeping' } : null,
  })
}

export async function clearAll () {
  if (Platform.OS === 'web') return
  await Notifications.cancelAllScheduledNotificationsAsync()
}
