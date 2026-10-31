// Google's test phones. Play installs every new build on its own phones for the pre-launch report,
// and a robot taps through setup, the help chat, the email box and the buy button. Android marks those
// phones with `firebase.test.lab`, which modules/test-phone reads. On one of them the app sends no
// usage counts, no chat message and no email, so a test phone never reaches the numbers, the new user
// email or the chat desk. From 31 October 2026. The web build reads `testPhone` from the gate's
// pretend store, so the gate walks a test phone too.
import { requireOptionalNativeModule } from 'expo'
import { Platform } from 'react-native'
import { readFake } from './phone.ts'

export const TEST_PHONE = Platform.OS === 'web'
  ? readFake().testPhone === true
  : requireOptionalNativeModule<{ isTestPhone?: boolean }>('TestPhone')?.isTestPhone === true
