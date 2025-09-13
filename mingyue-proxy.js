// Netlify Edge Function to proxy hidden upstream subscription
// Runtime: Deno (Edge Functions)

export default async (request, context) => {
  try {
    // Prefer a full upstream URL in env; fallback to composing from token
    let upstream = Netlify.env.get("UPSTREAM_MINGYUE_URL");
    const token = Netlify.env.get("MINGYUE_TOKEN");

    if (!upstream) {
      if (!token) {
        return new Response(
          "Server misconfigured: missing UPSTREAM_MINGYUE_URL or MINGYUE_TOKEN",
          { status: 500 }
        );
      }
      const base = Netlify.env.get("MINGYUE_BASE") ||
        "https://sub.pyden.dev/share/col/MingYue";
      const u = new URL(base);
      u.searchParams.set("token", token);
      // default target, can be overridden by query
      u.searchParams.set("target", "ClashMeta");
      upstream = u.toString();
    }

    // Allow overriding selected query params from client (optional)
    const reqUrl = new URL(request.url);
    ["target"].forEach((key) => {
      const v = reqUrl.searchParams.get(key);
      if (v) {
        const tmp = new URL(upstream);
        tmp.searchParams.set(key, v);
        upstream = tmp.toString();
      }
    });

    const res = await fetch(upstream, {
      headers: { "User-Agent": "Netlify-Edge/1.0 (+mingyue-proxy)" },
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return new Response(`Upstream error ${res.status}: ${text}`.trim(), {
        status: res.status,
      });
    }

    const body = await res.text();
    const headers = new Headers();
    headers.set("Content-Type", "text/yaml; charset=utf-8");
    headers.set(
      "Content-Disposition",
      "attachment; filename=\"mingyue\"; filename*=UTF-8''%E9%B8%A3%E7%BA%A6%E5%85%AC%E7%9B%8A%E8%8A%82%E7%82%B9"
    );
    // Conservative caching with SWR to absorb brief upstream jitters
    headers.set(
      "Cache-Control",
      "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
    );

    return new Response(body, { status: 200, headers });
  } catch (err) {
    return new Response(`Edge error: ${err?.message || err}`, { status: 500 });
  }
};
