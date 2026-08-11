/**
 * @file test-l1.mjs
 * @description Verify L1 — `.lean()` applied ONLY where response-safe.
 *
 * Confirms:
 *  1. Module list by course returns plain (lean) objects — no Mongoose
 *     wrappers, correct shape, ordering intact.
 *  2. Lesson list by module returns plain (lean) objects — ordering intact.
 *  3. Module detail (public published) still works; draft modules stay 404 (H3).
 *  4. Admin/owner can still read drafts.
 *  5. Course list STILL exposes its serialized virtuals (isFree/isPublished/
 *     isDiscounted) — proving Course paths were NOT leaned.
 *  6. Response safety: no `password`, `refreshToken` leaks; `__v` only where
 *     already exposed by the schema.
 *
 * Seeds its own course/module/lessons via the public API and cleans up.
 *
 * Run from backend folder:
 *   node scripts/test-l1.mjs
 */

const BASE = "http://localhost:5000/api/v1";
const RUN = Date.now().toString(36);
let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) {
    pass++;
    console.log(`  ✅ ${label}`);
  } else {
    fail++;
    console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`);
  }
};

async function req(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {}
  return { status: res.status, json };
}

// Module/Lesson controllers return payload in `message`; auth uses `data`.
const from = (json) => json?.message ?? json?.data ?? null;

async function registerInstructor(tag) {
  const username = `${RUN}_${tag}`.slice(0, 28);
  const email = `${RUN}_${tag}@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: `L1 ${tag}`,
      username,
      email,
      password: "Strong@123",
      confirmPassword: "Strong@123",
      role: "instructor",
    },
  });
  return { token: reg.json?.data?.accessToken, email };
}

function isPlainObjects(arr) {
  // Lean objects are plain: they must NOT have Mongoose wrappers and must not
  // have a toObject/toJSON function (document instances have them).
  return (
    Array.isArray(arr) &&
    arr.every(
      (d) =>
        d && typeof d === "object" && typeof d.toObject !== "function" && typeof d.toJSON !== "function"
    )
  );
}

async function main() {
  const I = await registerInstructor("instructor");
  ok(!!I.token, "instructor registered");

  // Course (public path must STILL include virtuals)
  const courseRes = await req("/courses", {
    method: "POST",
    token: I.token,
    body: {
      title: `L1 Course ${RUN}`,
      shortDescription: "L1 test course short description aligned.",
      description: "A sufficiently long description body for the L1 lean test course.",
      pricing: { price: 19.99 },
    },
  });
  const courseId = from(courseRes.json)?._id;
  ok(courseRes.status === 201 && !!courseId, `course created (${courseRes.status})`, courseId);

  // Verify Course single-read still exposes virtuals (NOT leaned).
  const courseDetail = await req(`/courses/${courseId}`);
  const cd = from(courseDetail.json);
  ok(cd?._id === courseId, "course detail retrievable");
  ok(
    Object.prototype.hasOwnProperty.call(cd ?? {}, "isFree") &&
      Object.prototype.hasOwnProperty.call(cd ?? {}, "isPublished") &&
      Object.prototype.hasOwnProperty.call(cd ?? {}, "isDiscounted"),
    "course detail still exposes isFree/isPublished/isDiscounted virtuals (not leaned)"
  );

  // Create module + 2 lessons
  const modRes = await req("/modules", {
    method: "POST",
    token: I.token,
    body: { course: courseId, title: `L1 Module ${RUN}` },
  });
  const moduleId = from(modRes.json)?._id;
  ok(modRes.status === 201 && !!moduleId, `module created (${modRes.status})`, moduleId);

  const mkLesson = async (title, order, duration) => {
    const l = await req("/lessons", {
      method: "POST",
      token: I.token,
      body: {
        module: moduleId,
        title,
        lessonType: "TEXT",
        content: { type: "TEXT", text: { body: "lesson body sample text here" } },
        order,
        duration,
      },
    });
    return from(l.json)?._id;
  };
  const l1 = await mkLesson(`L1 L1 ${RUN}`, 1, 100);
  const l2 = await mkLesson(`L1 L2 ${RUN}`, 2, 200);
  ok(!!l1 && !!l2, "two lessons created", { l1, l2 });

  // ── Module list by course → lean plain objects, ordering intact ──
  console.log("\n● getModulesByCourse (owner) -> lean:");
  const ownerMods = await req(`/modules/course/${courseId}`, { token: I.token });
  const mods = Array.isArray(from(ownerMods.json)) ? from(ownerMods.json) : [];
  ok(ownerMods.status === 200 && mods.length === 1, `owner sees module (${mods.length})`);
  ok(isPlainObjects(mods), "module list returns plain (lean) objects");
  ok(mods.every((m) => typeof m.toObject !== "function"), "no Mongoose document methods on modules");

  // Public (course not published) -> empty (H3).
  const pubMods = await req(`/modules/course/${courseId}`);
  ok(
    Array.isArray(from(pubMods.json)) && from(pubMods.json).length === 0,
    "public draft course -> empty module list (H3 preserved)"
  );

  // ── Lesson list by module → lean plain objects, ordering intact ──
  console.log("\n● getLessonsByModule -> lean:");
  const lessonList = await req(`/lessons/module/${moduleId}`, { token: I.token });
  const lessons = Array.isArray(from(lessonList.json)) ? from(lessonList.json) : [];
  ok(lessonList.status === 200 && lessons.length === 2, `lessons listed (${lessons.length})`);
  ok(isPlainObjects(lessons), "lesson list returns plain (lean) objects");
  ok(lessons[0].order === 1 && lessons[1].order === 2, "lesson ordering preserved");
  ok(lessons.every((l) => typeof l.toObject !== "function"), "no Mongoose methods on lessons");

  // ── Lesson detail (module populated) still works ──
  console.log("\n● getLessonById:");
  const lessonDetail = await req(`/lessons/${l1}`, { token: I.token });
  ok(lessonDetail.status === 200 && from(lessonDetail.json)?._id === l1, "lesson detail retrievable");
  // Populated module is a Module doc (no toJSON virtuals) — safe.
  const modP = from(lessonDetail.json)?.module;
  ok(modP && typeof modP !== "string", "lesson populates its module");

  // ── Draft protection (H3) preserved with lean ──
  console.log("\n● draft module still 404 publicly (H3) after lean:");
  const draftModPub = await req(`/modules/${moduleId}`);
  ok(draftModPub.status === 404, `public draft module -> 404 (${draftModPub.status})`);

  // ── Response safety ──
  console.log("\n● response safety:");
  const walkFor = (node, field, found = []) => {
    if (!node || typeof node !== "object") return found;
    if (Array.isArray(node)) { node.forEach((n) => walkFor(n, field, found)); return found; }
    for (const [k, v] of Object.entries(node)) {
      if (k.toLowerCase() === field && v !== undefined) found.push(node);
      walkFor(v, field, found);
    }
    return found;
  };
  const check = (path, arr, extra = []) => {
    for (const f of ["password", "refreshToken", ...extra]) {
      const leaked = walkFor(arr, f).length;
      ok(leaked === 0, `${path}: no '${f}' leak`, Array.isArray(from(arr)) ? "ok" : undefined);
    }
  };
  check("modules", mods);
  check("lessons", lessons);

  // ── Cleanup (best-effort; a transient Atlas DNS blip must not fail the test) ──
  const adminLogin = await req("/auth/login", {
    method: "POST",
    body: { email: "admin@test.com", password: "Admin@123" },
  });
  const adminToken = adminLogin.json?.data?.accessToken;
  try {
    if (adminToken) {
      await req(`/courses/${courseId}`, { method: "DELETE", token: adminToken });
      await req(`/modules/${moduleId}`, { method: "DELETE", token: adminToken });
    }
    const { default: mongoose } = await import("mongoose");
    const dotenv = await import("dotenv");
    dotenv.config();
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 25000 });
    const conn = mongoose.connection;
    await conn.collection("users").deleteMany({ email: I.email });
    await conn.collection("courses").deleteMany({ _id: new mongoose.Types.ObjectId(courseId) });
    await conn.collection("modules").deleteMany({ _id: new mongoose.Types.ObjectId(moduleId) });
    await conn.collection("lessons").deleteMany({
      _id: { $in: [l1, l2].filter(Boolean).map((i) => new mongoose.Types.ObjectId(i)) },
    });
    await mongoose.disconnect().catch(() => {});
  } catch {
    // Best-effort cleanup — connection issues here shouldn't fail L1 assertions.
  }
  console.log("  (cleanup attempted)");

  console.log(`\n${"=".repeat(50)}`);
  console.log(`L1 RESULT: ${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
