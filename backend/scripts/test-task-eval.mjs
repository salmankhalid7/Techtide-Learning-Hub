/**
 * @file test-task-eval.mjs
 * @description End-to-end test for the LessonX AI Assignment/Task feature:
 *
 *  Instructor side:
 *    1. create course + module
 *    2. create task (with rubric + submission settings + due date)
 *    3. get module tasks / get task
 *    4. publish task (requires rubric)
 *    5. list submissions / get single submission
 *    6. regrade a submission
 *
 *  Student side:
 *    7. enroll in course
 *    8. get published student task
 *    9. submit task (final) -> AI evaluation runs
 *   10. get my submission / history
 *   11. attempt-limit enforcement
 *
 * Run from backend folder:
 *   node scripts/test-task-eval.mjs
 */

const BASE = "http://localhost:5000/api/v1";
const RUN = Date.now().toString(36);
let pass = 0;
let fail = 0;
const ok = (cond, label, extra) => {
  if (cond) { pass++; console.log(`  ✅ ${label}`); }
  else { fail++; console.log(`  ❌ ${label}${extra ? ` — ${JSON.stringify(extra)}` : ""}`); }
};

// Load the same .env used by the server (for MONGODB_URI).
await import("dotenv/config");

// Direct DB access so we can publish a course (needs category+thumbnail which
// the API publish flow requires) and seed an enrollment, unlocking the student
// submission -> AI evaluation path without file-upload choreography.
let _mongoose;
let _db;
async function seedPublishCourse(courseId) {
  _mongoose = _mongoose ?? (await import("mongoose")).default;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI not set");
  if (!_db) {
    await _mongoose.connect(uri);
    _db = _mongoose.connection.db;
  }
  // Ensure a category exists.
  const cat = await _db.collection("categories").findOne({ name: "Testing" });
  const categoryId = cat
    ? cat._id
    : (await _db.collection("categories").insertOne({ name: "Testing", slug: "testing", createdAt: new Date(), updatedAt: new Date() })).insertedId;

  await _db.collection("courses").updateOne(
    { _id: new _mongoose.Types.ObjectId(courseId) },
    {
      $set: {
        category: categoryId,
        status: "published",
        publishedAt: new Date(),
        thumbnail: { url: "https://example.com/thumb.png" },
      },
    }
  );
}

async function seedEnrollment(courseId, studentId) {
  const existing = await _db.collection("enrollments").findOne({
    course: new _mongoose.Types.ObjectId(courseId),
    student: new _mongoose.Types.ObjectId(studentId),
  });
  if (existing) return existing._id;
  const now = new Date();
  const res = await _db.collection("enrollments").insertOne({
    student: new _mongoose.Types.ObjectId(studentId),
    course: new _mongoose.Types.ObjectId(courseId),
    status: "ACTIVE",
    enrolledAt: now,
    lastAccessedAt: now,
    metadata: {},
    createdAt: now,
    updatedAt: now,
  });
  return res.insertedId;
}

async function teardown() {
  if (_mongoose?.connection?.readyState === 1) {
    await _mongoose.disconnect();
  }
}

async function req(path, { method = "GET", token, body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method, headers, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
}

async function register(tag) {
  const username = `${RUN}_${tag}`.slice(0, 28);
  const email = `${RUN}_${tag}@example.com`;
  const reg = await req("/auth/register", {
    method: "POST",
    body: {
      fullName: `TaskEval ${tag}`,
      username,
      email,
      password: "Strong@123",
      confirmPassword: "Strong@123",
      role: tag.startsWith("instr") ? "instructor" : "student",
    },
  });
  return {
    token: reg.json?.data?.accessToken,
    userId: reg.json?.data?.user?._id,
    email,
  };
}

// Some existing controllers (e.g. course/module) return the created document
// under `message` rather than `data`. Normalise id extraction across shapes.
function pickId(json) {
  return json?.data?._id ?? json?.data?.[0]?._id ?? json?.message?._id ?? null;
}

async function main() {
  console.log(`\n=== Task / AI Evaluation E2E (run ${RUN}) ===\n`);

  // 1. Users
  const instructor = await register("instructor");
  const student = await register("student");
  ok(Boolean(instructor.token), "Instructor registered/login");
  ok(Boolean(student.token), "Student registered/login");

  // 2. Instructor creates a course
  const courseRes = await req("/courses", {
    method: "POST",
    token: instructor.token,
    body: {
      title: `TaskEval Course ${RUN}`,
      shortDescription: "End-to-end assignment test course covering AI task evaluation.",
      description: "A comprehensive course created to exercise the full AI assignment and task evaluation workflow from instructor creation through student submission.",
      pricing: { price: 0 },
    },
  });
  const courseId = pickId(courseRes.json);
  ok(Boolean(courseId), "Instructor created course", courseRes.json?.message || courseRes.json?.data);

  // 3. Instructor creates a module
  const modRes = await req(`/modules`, {
    method: "POST",
    token: instructor.token,
    body: { course: courseId, title: "Assignment Module", description: "module", order: 1 },
  });
  const moduleId = pickId(modRes.json);
  ok(Boolean(moduleId), "Instructor created module", modRes.json?.message || modRes.json?.data);

  // 4. Create the task
  const createTaskRes = await req(`/modules/${moduleId}/tasks`, {
    method: "POST",
    token: instructor.token,
    body: {
      course: courseId,
      module: moduleId,
      title: "Explain SOLID principles",
      description: "Write a concise explanation of SOLID.",
      instructions:
        "Explain each SOLID principle (Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion) with a short example.",
      taskType: "WRITTEN",
      difficulty: "MEDIUM",
      maxScore: 100,
      passingScore: 60,
      dueDate: new Date(Date.now() + 86400000).toISOString(), // tomorrow
      rubric: [
        { criterion: "Principle coverage", description: "explain single responsibility open closed liskov interface dependency inversion", maxPoints: 50, order: 1 },
        { criterion: "Examples", description: "example concrete code illustration", maxPoints: 30, order: 2 },
        { criterion: "Clarity", description: "clear concise well structured", maxPoints: 20, order: 3 },
      ],
      submissionSettings: { allowedTypes: ["TEXT"], attemptLimit: 2, allowLateSubmission: false },
    },
  });
  const taskId = pickId(createTaskRes.json);
  ok(Boolean(taskId), "Instructor created task", createTaskRes.json?.message || (createTaskRes.json?.data && createTaskRes.json.data.errors));

  // 5. Get module tasks + get task
  const listRes = await req(`/modules/${moduleId}/tasks`, { token: instructor.token });
  ok(Array.isArray(listRes.json?.data?.tasks) && listRes.json.data.tasks.length === 1, "Listed module tasks");
  const getRes = await req(`/tasks/${taskId}`, { token: instructor.token });
  ok(Boolean(getRes.json?.data?._id), "Instructor fetched task by ID");

  // 6. Publish task (should require rubric — present, so succeeds)
  const pubRes = await req(`/tasks/${taskId}/publish`, { method: "PATCH", token: instructor.token });
  ok(pubRes.status === 200 && pubRes.json?.data?.status === "PUBLISHED", "Published task", pubRes.json?.data);

  // Publish the course via DB seed (course publish needs category+thumbnail).
  await seedPublishCourse(courseId);
  ok(true, "Course seeded to published");

  // 7. Student enrollment — seed an ACTIVE enrollment directly.
  await seedEnrollment(courseId, student.userId);
  ok(true, "Student ACTIVE enrollment seeded");

  // 8. Student fetches published task
  const studGet = await req(`/tasks/${taskId}/student`, { token: student.token });
  ok(studGet.status === 200 && studGet.json?.data?.status === "PUBLISHED", "Student fetched published task");

  // 9. Student submits (final) -> AI evaluation
  const submitRes = await req(`/tasks/${taskId}/submit`, {
    method: "POST",
    token: student.token,
    body: {
      isFinal: true,
      content: {
        textContent:
          "SOLID means single responsibility, open closed principle, liskov substitution, interface segregation and dependency inversion. For example, a class should have one clear example and use dependency injection for concrete code illustration.",
      },
    },
  });
  const submission = submitRes.json?.data;
  ok(
    submitRes.status === 201 && submission?.aiEvaluation?.status === "COMPLETED" && submission?.finalScore != null,
    "Student submitted -> AI evaluated",
    { status: submitRes.status, aiStatus: submission?.aiEvaluation?.status, finalScore: submission?.finalScore }
  );
  ok(submission?.aiEvaluation?.feedback, "AI feedback present");
  ok(Array.isArray(submission?.aiEvaluation?.rubricResults) && submission.aiEvaluation.rubricResults.length === 3, "Rubric results present");

  const submissionId = submission?._id;

  // 10. Student history
  const mySubs = await req(`/tasks/${taskId}/my-submissions`, { token: student.token });
  ok(Array.isArray(mySubs.json?.data?.submissions), "Student fetched submission history");
  const myOne = await req(`/tasks/${taskId}/my-submission`, { token: student.token });
  ok(Boolean(myOne.json?.data?._id), "Student fetched latest submission");

  // 11. Instructor lists + views submission
  const subs = await req(`/tasks/${taskId}/submissions`, { token: instructor.token });
  ok(Array.isArray(subs.json?.data?.submissions), "Instructor listed submissions");
  const single = await req(`/tasks/${taskId}/submissions/${submissionId}`, { token: instructor.token });
  ok(single.status === 200, "Instructor fetched single submission");

  // 12. Instructor regrades
  const fixedScore = Math.max(1, (submission?.finalScore ?? 0) + 5);
  const regrade = await req(`/tasks/${taskId}/submissions/${submissionId}/regrade`, {
    method: "PATCH",
    token: instructor.token,
    body: { score: fixedScore, feedback: "Reviewed manually — good effort.", comment: "Instructor override." },
  });
  ok(
    regrade.status === 200 && regrade.json?.data?.finalScore === fixedScore && regrade.json?.data?.gradedBy,
    "Instructor regraded submission",
    { finalScore: regrade.json?.data?.finalScore }
  );

  // 13. Attempt limit — draft then final twice; third final should fail (attemptLimit=2)
  const ok1 = await req(`/tasks/${taskId}/submit`, { method: "POST", token: student.token, body: { isFinal: true, content: { textContent: "attempt two submission content for solid." } } });
  const ok2 = await req(`/tasks/${taskId}/submit`, { method: "POST", token: student.token, body: { isFinal: true, content: { textContent: "attempt three blocked beyond limit." } } });
  ok(ok1.status === 201, "Second (final) attempt accepted");
  ok(ok2.status === 400, "Attempt limit rejected third final attempt", { status: ok2.status, msg: ok2.json?.message });

  // 14. Module assignmentCount maintained (task create refreshes module stats)
  // NOTE: the module controller passes the module doc as the `message` arg
  // (an existing quirk), so it lands in json.message rather than json.data.
  const modGet = await req(`/modules/${moduleId}`, { token: instructor.token });
  const modCandidate = modGet.json?.data ?? modGet.json?.message ?? {};
  const modData = typeof modCandidate === "object" && modCandidate?.stats ? modCandidate : modGet.json?.message;
  const assignmentCount = modData?.stats?.assignmentCount;
  ok(assignmentCount === 1, "Module assignmentCount = 1 after task creation", { assignmentCount, status: modGet.status });

  // 15. Non-owner instructor forbidden from another course's task
  const otherInstr = await register("instructor2");
  const otherCourseRes = await req("/courses", {
    method: "POST",
    token: otherInstr.token,
    body: { title: `Other Course ${RUN}`, shortDescription: "Course owned by a second instructor for permission testing.", description: "This course belongs to a different instructor to verify that they cannot mutate another instructor's task.", pricing: { price: 0 } },
  });
  const otherCourseId = pickId(otherCourseRes.json);
  ok(Boolean(otherCourseId), "Second instructor created own course");
  const otherPub = await req(`/tasks/${taskId}/publish`, { method: "PATCH", token: otherInstr.token });
  ok(otherPub.status === 403, "Non-owner instructor forbidden from mutating task", otherPub.status);

  await teardown();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail ? 1 : 0);
}

main().catch(async (err) => {
  console.error("Test error:", err.message);
  await teardown().catch(() => {});
  process.exit(1);
});
