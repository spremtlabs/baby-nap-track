# App Store listing

What goes into App Store Connect for Baby Nap Track on an iPhone, and the steps to the first release. The
description is the Full description in `store/listing.md`, word for word, so the two stores say the
same thing. The price comes from https://babynaptrack.com/llms.txt and from nowhere else.
Apple's rules behind each answer were read on developer.apple.com on 7 October 2026.

## Name

Baby Nap Track: Sleep Tracker

That is 29 characters, and Apple allows 30. The app was called Snug until 8 October 2026, and another app
on the App Store is called `Snug: AI Baby Sleep Tracker`. The name changes in App Store Connect only while
a version can be edited, and it matches the name under the icon, which comes from `expo.name` in `app.json`.

## Subtitle

Nap times from wake windows

## Keywords

schedule,predictor,toddler,newborn,infant,bedtime,routine,log,timer,naptime,age,month,diary

Apple searches the words in the name and the subtitle already, so the keywords carry the rest of
what parents type, from the list at the top of `store/listing.md`. `diary` makes `sleep diary` with
the name. Apple allows 100 characters and refuses another app's name in this field.

## Promotional text

Tap when your baby falls asleep and when they wake. Baby Nap Track gives you the next nap time from their age and their own naps.

## Category

Health & Fitness first and Lifestyle second. Apple has no Parenting category.

A Health & Fitness app has to answer whether it is a regulated medical device in the EU, the UK and
the US. Baby Nap Track is not one, so the answer is No. Only the Account Holder or an Admin can answer it.

## Age rating

The answers to Apple's questions:

- Parental controls, age assurance: No.
- Unrestricted web access: No. The Privacy link opens Safari, outside the app.
- User-generated content, social media, advertising: No.
- Messaging and chat: No. The help chat reaches Spremt Labs only, and parents cannot message each
  other.
- Mature themes, sexuality or nudity, violence, gambling, contests, loot boxes: None.
- Medical or treatment information: None.
- Health or wellness topics: Yes. The nap times and the day sleep aim are sleep advice for a baby.

That makes Baby Nap Track 9+. Not made for kids: Baby Nap Track is for parents and stays out of the Kids category, and
its name, screenshots and description talk to parents.

## Links

- Support: https://babynaptrack.com/
- Privacy: https://babynaptrack.com/privacy/

## Screenshots

`npm run check`, then `node store/shots.mjs --apple`, writes the 6.9 inch iPhone set into
`store/assets/app-store/`: six at 1290x2796, from the next nap to the sleep diary. Apple scales them
down for the smaller iPhones, and Baby Nap Track runs on iPhone only, so no iPad set is needed. The help
button is left out of these six because it floated over a nap's length in four of them.

## The in-app purchases

Two items. The first in-app purchases go to review with the first version, so both are added on the
version page before the version is submitted.

The nap times:

- Type: Non-Consumable. Product id `snug_lifetime`, the same id Play uses.
- Reference name: Baby Nap Track nap times. Display name: Nap times. Description: Keeps the nap times after
  the free week.
- Price: the price point that matches the euro price in `llms.txt`.
- Review screenshot: `SHOTS=<folder> npm run check` saves `locked.png`, the Today screen once the
  free week is up.

The free week:

- Type: Non-Consumable. Product id `snug_trial`. The app asks the App Store for this id and no
  other, and `npm run check` fails if the app and this file name different ones.
- Reference name: Baby Nap Track free week. Display name: `7-day Trial`. Description: Gives you the nap times
  free for 7 days.
- Price: Free, the price point at zero in every country.
- Family Sharing: off, so each parent's Apple Account starts its own week.
- Review screenshot: `SHOTS=<folder> npm run check` saves `iphone-week.png`, the last setup screen
  with Start my free week on it.

## The free week on an iPhone

Apple's guideline 3.1.1 names one way for an app without a subscription to give a free time-based
trial: a free non-consumable called `7-day Trial`, which the person taps to start. Before the trial
starts, the app has to say how long it runs, what stops at the end and what paying for the rest
costs. Baby Nap Track does this as mock iphone-trial-and-counts v1 draws it:

- The last setup screen says the week runs to the end of a named day, what it gives, what stops after
  it and the price, with `The App Store will ask you to confirm the free week.` over the button.
- Start my free week opens Apple's sheet on the free `snug_trial` item. The week starts when the App
  Store confirms it, and runs from the date the App Store gives for it, so an Apple Account that
  took it before keeps the week it had.
- `Not now` opens Today. Logging, the timer, today's list, the week and sharing work as before. The
  nap time's place says `Nap times are free for 7 days` with the price after it and a Start my free
  week button. Settings, under Nap times, has the same button, `Get them now` and `Paid already?
  Restore it`.
- An App Store that has the price and not the `snug_trial` item locks nothing.

Android's free week starts on its own the first time Play shows the price, as it always has.

## App privacy answers

- Tracking: No.
- Contact Info, Name: the baby's first name, once a parent shares the log. App Functionality.
  Linked to the user.
- Contact Info, Email Address: only when typed into the help chat. App Functionality. Linked.
- Health and Fitness, Health: the sleep times, the date of birth and the due date, once a parent
  shares the log. App Functionality. Linked.
- User Content, Customer Support: what a parent types into the help chat. App Functionality.
  Linked.
- Usage Data, Product Interaction: the steps listed on the privacy page. Analytics. Not linked: each
  run of the app makes a new random id, and PostHog throws the IP address away. On an iPhone they go
  only after the parent says yes, and Apple still counts them as collected, so this answer stays.

Apple counts personal data as linked, and a shared log holds a baby's name and date of birth. The
sleep diary goes from the phone through the share panel to whoever the parent picks, so nothing
of it reaches Spremt Labs, and Apple takes the payment. The privacy manifest in `app.json` declares
the same five, and `npm run check` fails if one goes missing.

Guideline 5.1.1(ii) asks for the parent's consent before usage data is collected, even when it is
anonymous, and for a way to withdraw it. On an iPhone setup asks `Can Baby Nap Track send us counts of how it's
used?` after the questions about the baby, and Baby Nap Track sends nothing to PostHog until the answer is yes.
Settings keeps the answer as a switch, `Send counts of how Baby Nap Track is used`, above the Privacy link, and
turning it off stops the counts. `npm run check` walks both answers and fails if a count goes before
a yes.

## Notes for Apple's reviewer

Baby Nap Track needs no account, so there is no sign-in. Setup asks for a baby's name and date of birth, and
any name and date work.

The last setup screen offers the free week. Start my free week opens Apple's sheet on the free
`7-day Trial` item, and the nap times are free for 7 days from then. Not now skips it, and the same
button then sits on the main screen and in Settings under Nap times. To buy, open Settings at the top
right of the main screen and tap the button under Nap times that starts `Get them now`. `Paid
already? Restore it` sits under it. Logging sleep, the timer, the week, sharing and the sleep diary
stay free.

The screen before it asks whether Baby Nap Track may send usage counts, and Baby Nap Track sends none until the answer
is yes. Settings has a switch to change the answer.

Baby Nap Track works out each nap time from the baby's age and the naps logged, using the usual wake windows
for that age. Settings, under How the times are worked out, asks a worried parent to talk to their
GP or public health nurse.

The help icon opens a chat with Spremt Labs. Sharing sends a link that lets another carer see and
log the same baby's sleep.

## The first iPhone release

In order. `Founder` marks a click that pays, signs, declares for the company or handles the key.
`Session` is work a session does, in the founder's signed-in Chrome where it says so.

1. Founder. Apple emails when the enrolment clears. Sign the Program License Agreement and pay for
   the membership at https://developer.apple.com/account.
2. Founder. App Store Connect, Business: sign the Paid Apps Agreement, add the bank account and the
   US tax form W-8BEN-E. It has to show Active before the purchase works for Apple's reviewer.
   Apple's Irish tax form is only for a company registered for VAT.
3. Founder. App Store Connect, Business: EU trader status. Spremt Labs Limited is a trader. The
   address comes from the D-U-N-S record, and the phone number and email are confirmed with codes.
   All three show on the App Store in the EU, and without them Baby Nap Track is left out of the EU stores.
4. Founder. Users and Access, Integrations, App Store Connect API: a Team key with the Admin role.
   Download the .p8 file, which Apple offers once, and note the Key ID and the Issuer ID. The Team
   ID is at https://developer.apple.com/account under Membership details.
5. Session, in Chrome. Apps, New App: iOS, the name above, English (U.K.), bundle id
   `com.spremtlabs.babysleep`, SKU `snug-ios`. The app's Apple ID, all digits, is then under App
   Information.
6. Founder. Six repository secrets at
   https://github.com/spremtlabs/baby-sleep/settings/secrets/actions: `ASC_API_KEY_P8` (the whole
   .p8 file), `ASC_API_KEY_ID`, `ASC_API_KEY_ISSUER_ID`, `APPLE_TEAM_ID`, `ASC_APP_ID` (the app's
   Apple ID) and `EXPO_TOKEN`, which is there already.
7. Session, once, in `~/dev/baby-sleep` on the Mac with the .p8 file on it: the distribution
   certificate and provisioning profile, which a build on the runner cannot make. The key signs
   in, so no Apple password is asked for. Answer yes to a new certificate and a new profile.

   ```
   EXPO_ASC_API_KEY_PATH=<the .p8 file> EXPO_ASC_KEY_ID=<key id> EXPO_ASC_ISSUER_ID=<issuer id> \
   EXPO_APPLE_TEAM_ID=<team id> EXPO_APPLE_TEAM_TYPE=COMPANY_OR_ORGANIZATION \
   npx eas-cli@latest credentials:configure-build --platform ios --profile production
   ```

8. Session, in Chrome. The two in-app purchases as above, with their prices and review screenshots.
9. Session, in Chrome. The version page: the six screenshots, the promotional text, the
   description, the keywords, the links, the category, the age rating, the App Privacy answers, the
   reviewer notes, sign-in not required, and Copyright 2026 Spremt Labs Limited. The founder answers
   the medical device question.
10. Session. The privacy page and `llms.txt` name the App Store beside Google Play, the privacy
    page says Apple takes the payment on an iPhone and that an iPhone asks before it sends counts,
    and `llms.txt` says the iPhone's free week starts from the `7-day Trial` item, in one push to
    the site's repo. The join page
    gets an App Store button once the app is live.
11. Session. `gh workflow run ios-release.yml -R spremtlabs/baby-sleep` runs the gate, builds on
    Expo's Macs and sends the build to App Store Connect. It shows under TestFlight once Apple has
    processed it. The export question is answered by `app.json`.
12. Session, in Chrome. Pick that build on the version page for the version in `app.json`, and add
    `snug_lifetime` and `snug_trial` to it.
13. Founder. Submit for review.
