// Sends the sleep diary through the phone's own share panel, the PDF and the spreadsheet together,
// so the parent picks email, WhatsApp or anything else on the phone. The web build uses send.ts.
import * as Print from 'expo-print'
import Share from 'react-native-share'
import type { Diary } from './diary.ts'
import { base64 } from './send.ts'

export { base64 }

export async function sendDiary (d: Diary): Promise<'sent' | 'failed'> {
  try {
    // A4 in points. The page's own CSS sets the margins and where the table starts a new page.
    const pdf = await Print.printToFileAsync({ html: d.html, width: 595, height: 842, base64: true })
    if (!pdf.base64) return 'failed'
    await Share.open({
      urls: [`data:application/pdf;base64,${pdf.base64}`, `data:text/csv;base64,${base64(d.csv)}`],
      filenames: [`${d.base}.pdf`, `${d.base}.csv`],
      // The files are written to the app's own cache, which needs no storage permission.
      useInternalStorage: true,
      failOnCancel: false,
      title: d.base,
      subject: d.base,
    })
    return 'sent'
  } catch {
    return 'failed'
  }
}
