const app = document.getElementById("app");
let state = { q: "", tag: "" };

const api = async (url, opts = {}) => {
  const res = await fetch(url, { headers: { "Content-Type": "application/json" }, ...opts });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || "Something went wrong."), { data });
  return data;
};

function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) n.setAttribute(k, v);
  }
  for (const c of kids.flat()) n.append(c?.nodeType ? c : document.createTextNode(c ?? ""));
  return n;
}

const fmt = (iso) => new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 2200);
}

const meta = (p) => el("div", { class: "meta" }, `${p.author} on ${fmt(p.created_at)}`);
const chipLinks = (p) => el("div", { class: "chips" }, p.tags.map((t) =>
  el("a", { class: "chip", href: "#/", onclick: (e) => {
    e.preventDefault(); state.tag = t;
    if (location.hash.startsWith("#/post")) location.hash = "#/"; else renderList();
  } }, t)));

async function renderList() {
  const [posts, tags] = await Promise.all([
    api(`/api/posts?q=${encodeURIComponent(state.q)}&tag=${encodeURIComponent(state.tag)}`),
    api("/api/tags"),
  ]);
  const search = el("input", { type: "search", placeholder: "Search posts", "aria-label": "Search posts", value: state.q });
  let timer;
  search.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(async () => { state.q = search.value; await refreshEntries(); }, 250);
  });
  const chips = el("div", { class: "chips" }, tags.map(([t, n]) =>
    el("button", { class: "chip" + (state.tag === t ? " on" : ""), onclick: async () => {
      state.tag = state.tag === t ? "" : t; await renderList(); } }, `${t} (${n})`)));
  const list = el("div", { id: "entries" });
  app.replaceChildren(el("div", { class: "tools" }, search, tags.length ? chips : ""), list);
  fillEntries(list, posts);
  async function refreshEntries() {
    fillEntries(list, await api(`/api/posts?q=${encodeURIComponent(state.q)}&tag=${encodeURIComponent(state.tag)}`));
  }
}

function fillEntries(list, posts) {
  if (!posts.length) {
    list.replaceChildren(el("div", { class: "empty" }, "No posts match. ",
      el("a", { href: "#/new" }, "Write a new post"), " or clear your search."));
    return;
  }
  list.replaceChildren(...posts.map((p) => el("div", { class: "entry" },
    el("h2", {}, el("a", { href: `#/post/${p.id}` }, p.title)),
    meta(p),
    el("p", { class: "excerpt" }, p.body.length > 200 ? p.body.slice(0, 200).trimEnd() + "…" : p.body),
    chipLinks(p))));
}

async function renderPost(id) {
  const p = await api(`/api/posts/${id}`);
  document.title = `${p.title} · Fieldnotes`;
  app.replaceChildren(el("article", {},
    el("h1", {}, p.title), meta(p), chipLinks(p),
    el("div", { style: "margin-top:24px" }, p.body.split(/\n{2,}/).map((para) => el("p", {}, para))),
    el("div", { class: "actions" },
      el("a", { class: "btn", href: `#/edit/${p.id}` }, "Edit post"),
      el("button", { class: "btn danger", onclick: async () => {
        if (!confirm("Delete this post? This can't be undone.")) return;
        await api(`/api/posts/${p.id}`, { method: "DELETE" });
        toast("Post deleted"); location.hash = "#/";
      } }, "Delete post"))));
}

async function renderForm(id) {
  const p = id ? await api(`/api/posts/${id}`) : { title: "", author: "", tags: [], body: "" };
  const f = {
    title: el("input", { id: "title", maxlength: 150, value: p.title }),
    author: el("input", { id: "author", value: p.author }),
    tags: el("input", { id: "tags", value: p.tags.join(", ") }),
    body: el("textarea", { id: "body" }, p.body),
  };
  const errs = {};
  const field = (key, label, hint) => {
    errs[key] = el("div", { class: "err" });
    return [el("label", { for: key }, label), f[key], hint ? el("div", { class: "hint" }, hint) : "", errs[key]];
  };
  const form = el("form", { novalidate: true, onsubmit: async (e) => {
    e.preventDefault();
    Object.values(errs).forEach((n) => (n.textContent = ""));
    const payload = Object.fromEntries(Object.entries(f).map(([k, n]) => [k, n.value]));
    try {
      const saved = await api(id ? `/api/posts/${id}` : "/api/posts", { method: id ? "PUT" : "POST", body: JSON.stringify(payload) });
      toast(id ? "Changes saved" : "Post published");
      location.hash = `#/post/${saved.id}`;
    } catch (err) {
      for (const [k, m] of Object.entries(err.data?.errors || {})) errs[k].textContent = m;
      if (!err.data?.errors) toast(err.message);
    }
  } },
    ...field("title", "Title"), ...field("author", "Author"),
    ...field("tags", "Tags", "Separate tags with commas."), ...field("body", "Body", "Leave a blank line between paragraphs."),
    el("div", { class: "actions" },
      el("button", { class: "btn primary", type: "submit" }, id ? "Save changes" : "Publish post"),
      el("a", { class: "btn", href: id ? `#/post/${id}` : "#/" }, "Cancel")));
  app.replaceChildren(el("h1", { style: "margin-top:0" }, id ? "Edit post" : "New post"), form);
  f.title.focus();
}

async function route() {
  document.title = "Fieldnotes";
  const [, page, id] = location.hash.split("/");
  try {
    if (page === "post" && id) await renderPost(id);
    else if (page === "new") await renderForm();
    else if (page === "edit" && id) await renderForm(id);
    else await renderList();
  } catch (e) {
    app.replaceChildren(el("div", { class: "empty" }, e.message, " ", el("a", { href: "#/" }, "Back to all posts")));
  }
  window.scrollTo(0, 0);
}
addEventListener("hashchange", route);
route();
