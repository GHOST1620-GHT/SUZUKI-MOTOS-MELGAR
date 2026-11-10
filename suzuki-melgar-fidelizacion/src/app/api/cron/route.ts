/** Tareas diarias (cumpleaños y vencimientos). Programe: GET /api/cron?key=CRON_SECRET una vez al día. */
import { NextResponse } from "next/server";
import { runDailyJobs } from "@/lib/loyalty";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key") ?? req.headers.get("authorization")?.replace("Bearer ", "");
  if (!process.env.CRON_SECRET || key !== process.env.CRON_SECRET) return NextResponse.json({ ok: false }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runDailyJobs()) });
}
