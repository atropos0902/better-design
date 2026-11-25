/** One origin for the browser, so session cookies and the origin check work without CORS. Redirects and cookies pass through untouched. */
const FORWARD = ["cookie", "origin", "content-type"];
const BACK = ["content-type", "location", "cache-control"];

export async function forward(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const headers = new Headers();
  for (const h of FORWARD) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  try {
    const res = await fetch(`${process.env["SERVICE_URL"]}${url.pathname}${url.search}`, { method: req.method, headers, redirect: "manual", ...(req.method === "GET" ? {} : { body: await req.text() }) });
    const out = new Headers();
    for (const h of BACK) {
      const v = res.headers.get(h);
      if (v) out.set(h, v);
    }
    for (const c of res.headers.getSetCookie()) out.append("set-cookie", c);
    return new Response(res.body, { status: res.status, headers: out });
  } catch {
    return Response.json({ error: "the review service can't be reached" }, { status: 502 });
  }
}
