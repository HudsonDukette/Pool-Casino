import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? "mailto:admin@poolcasino.app",
  process.env.VAPID_PUBLIC_KEY ?? "",
  process.env.VAPID_PRIVATE_KEY ?? ""
);

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export async function sendPushToUser(userId: number, payload: PushPayload) {
  const subs = await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.userId, userId));
  const dead: number[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) dead.push(sub.id);
      }
    })
  );

  if (dead.length > 0) {
    await Promise.allSettled(dead.map(id => db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.id, id))));
  }
}
