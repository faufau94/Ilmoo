import { initializeApp, cert, type ServiceAccount } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';

const app = initializeApp({
  credential: cert({
    projectId: process.env['FIREBASE_PROJECT_ID'],
    clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
    privateKey: process.env['FIREBASE_PRIVATE_KEY']?.replace(/\\n/g, '\n'),
  } as ServiceAccount),
});

const auth = getAuth(app);
const messaging = getMessaging(app);

export async function verifyToken(idToken: string): Promise<DecodedIdToken> {
  return auth.verifyIdToken(idToken);
}

export async function sendPushNotification(
  fcmToken: string,
  title: string,
  body: string,
): Promise<string> {
  return messaging.send({
    token: fcmToken,
    notification: { title, body },
  });
}
