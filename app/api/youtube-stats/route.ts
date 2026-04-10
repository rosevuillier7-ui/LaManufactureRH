import { NextRequest, NextResponse } from "next/server";

const YT_BASE = "https://www.googleapis.com/youtube/v3";
const YT_ANALYTICS = "https://youtubeanalytics.googleapis.com/v2";

async function tryRefresh(refreshToken: string): Promise<string | null> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.access_token ?? null;
}

export async function GET(request: NextRequest) {
  const accessTokenCookie = request.cookies.get("yt_access_token")?.value;
  const refreshTokenCookie = request.cookies.get("yt_refresh_token")?.value;

  if (!accessTokenCookie && !refreshTokenCookie) {
    return NextResponse.json({ connected: false });
  }

  let token = accessTokenCookie;
  let freshToken: string | undefined;

  if (!token) {
    const newToken = await tryRefresh(refreshTokenCookie!);
    if (!newToken) return NextResponse.json({ connected: false });
    token = newToken;
    freshToken = newToken;
  }

  // Fetches a YouTube API URL, auto-refreshing the token once on 401
  async function callApi(url: string) {
    let res = await fetch(url, { headers: { Authorization: `Bearer ${token!}` } });
    if (res.status === 401 && refreshTokenCookie) {
      const newToken = await tryRefresh(refreshTokenCookie);
      if (!newToken) throw new Error("token_expired");
      token = newToken;
      freshToken = newToken;
      res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    }
    if (!res.ok) throw new Error(`api_error_${res.status}`);
    return res.json();
  }

  try {
    // Channel stats + uploads playlist ID in one call
    const channelData = await callApi(
      `${YT_BASE}/channels?part=statistics,contentDetails&mine=true`
    );

    const channel = channelData.items?.[0];
    if (!channel) return NextResponse.json({ connected: false });

    const stats = channel.statistics;
    const uploadsPlaylistId = channel.contentDetails.relatedPlaylists.uploads;
    const today = new Date().toISOString().split("T")[0];

    // Playlist items + analytics in parallel
    const [playlistData, analyticsData] = await Promise.all([
      callApi(
        `${YT_BASE}/playlistItems?part=contentDetails&playlistId=${uploadsPlaylistId}&maxResults=20`
      ),
      callApi(
        `${YT_ANALYTICS}/reports?ids=channel==MINE&startDate=2020-01-01&endDate=${today}&metrics=averageViewDuration`
      ).catch(() => null),
    ]);

    // Video statistics
    const videoIds: string = (playlistData.items ?? [])
      .map((item: { contentDetails: { videoId: string } }) => item.contentDetails.videoId)
      .join(",");

    const videosData = videoIds
      ? await callApi(`${YT_BASE}/videos?part=statistics,snippet&id=${videoIds}`)
      : null;

    const videos = (videosData?.items ?? []).map(
      (v: { id: string; snippet: { title: string }; statistics: { viewCount: string } }) => ({
        id: v.id,
        title: v.snippet.title,
        views: parseInt(v.statistics.viewCount, 10) || 0,
      })
    );

    const avgWatchDuration: number | null =
      analyticsData?.rows?.[0]?.[0] != null
        ? Math.round(analyticsData.rows[0][0])
        : null;

    const body = {
      connected: true,
      totalViews: parseInt(stats.viewCount, 10) || 0,
      subscribers: stats.hiddenSubscriberCount
        ? null
        : parseInt(stats.subscriberCount, 10) || 0,
      avgWatchDuration,
      videos,
    };

    const response = NextResponse.json(body);

    if (freshToken) {
      response.cookies.set("yt_access_token", freshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    }

    return response;
  } catch {
    return NextResponse.json({ connected: false });
  }
}
