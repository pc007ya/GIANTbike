const { initializeTestEnvironment, assertFails, assertSucceeds } = require("@firebase/rules-unit-testing");
const { doc, setDoc, updateDoc, getDocFromServer, getDocsFromServer, collection, deleteDoc } = require("firebase/firestore");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const assert = require("node:assert/strict");

async function run() {
  const host = process.env.FIRESTORE_EMULATOR_HOST || "";
  const projectId = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || "";
  if (projectId !== "demo-giantbike-registry" || !/^127\.0\.0\.1:[0-9]+$/.test(host)) {
    throw new Error("Use the isolated demo-giantbike-registry with a loopback Firestore emulator.");
  }
  const env = await initializeTestEnvironment({ projectId, firestore: {
    host: "127.0.0.1", port: Number(host.split(":")[1]), rules: readFileSync(join(__dirname, "../firestore.rules"), "utf8"),
  }});
  const now = Math.floor(Date.now() / 1000);
  const emailA = "user-a@example.invalid";
  const emailB = "user-b@example.invalid";
  const A = "fixture-a", B = "fixture-b";
  const identity = (uid, email, provider = "password", sub = null, extra = {}) => env.authenticatedContext(uid, {
    email, email_verified: true, auth_time: now,
    firebase: { sign_in_provider: provider, identities: sub ? { "google.com": [sub] } : {} },
    ...extra,
  }).firestore();
  const registry = (db, uid = "user-a") => doc(db, "bff_supplierAccounts", uid);
  const grant = (db, uid = "user-a") => doc(db, "bff_googleLinks", uid);
  const stock = (db, vendor) => doc(db, "bff_stock", vendor);
  const admin = identity("admin-user", "pc007ya@gmail.com", "google.com", "teacher");
  const password = identity("user-a", emailA, "password", "google-ident-a");
  const google = identity("user-a", emailA, "google.com", "google-ident-a");
  const wrongGoogle = identity("user-a", emailA, "google.com", "google-ident-b");
  const supplierB = identity("user-b", emailB, "password", "google-ident-b");
  const stale = identity("user-a", emailA, "password", "google-ident-a", { auth_time: now - 301 });
  const anonymous = env.unauthenticatedContext().firestore();
  const signedAnon = identity("user-a", emailA, "anonymous", "google-ident-a");

  try {
    await assertSucceeds(setDoc(registry(admin), { email: emailA, vendorId: A, enabled: true }));
    await assertSucceeds(setDoc(registry(admin, "user-b"), { email: emailB, vendorId: B, enabled: true }));
    await assertFails(setDoc(registry(admin, "example-upper"), { email: "UPPER@example.invalid", vendorId: B, enabled: true }));
    await assertFails(setDoc(registry(admin, "example-reserved"), { email: emailA, vendorId: "admin", enabled: true }));
    await assertFails(setDoc(registry(admin, "example-extra"), { email: emailA, vendorId: A, enabled: true, admin: true }));
    await assertFails(setDoc(registry(admin, "example-admin"), { email: "pc007ya@gmail.com", vendorId: A, enabled: true }));
    await assertFails(updateDoc(registry(admin), { vendorId: B }));
    await assertFails(updateDoc(registry(admin), { email: emailB }));
    await assertFails(deleteDoc(registry(admin)));
    assert.equal((await assertSucceeds(getDocsFromServer(collection(admin, "bff_supplierAccounts")))).size, 2);
    await assertFails(getDocsFromServer(collection(password, "bff_supplierAccounts")));
    await assertFails(updateDoc(registry(password), { enabled: false }));
    await assertFails(setDoc(registry(password, "example-self"), { email: emailA, vendorId: B, enabled: true }));

    await assertSucceeds(setDoc(stock(admin, A), { recorded: 13 }));
    await assertSucceeds(setDoc(stock(admin, B), { recorded: 27 }));
    const checkA = async db => assert.equal((await assertSucceeds(getDocFromServer(stock(db, A)))).data().recorded, 13);
    const checkRegistry = async db => assert.equal((await assertSucceeds(getDocFromServer(registry(db)))).data().vendorId, A);
    await checkA(password);
    await checkRegistry(password);
    await checkRegistry(identity("user-a", "USER-A@example.invalid"));
    await assertFails(getDocFromServer(registry(supplierB)));
    await assertFails(getDocFromServer(stock(password, B)));
    await assertFails(getDocFromServer(registry(anonymous)));
    await assertFails(getDocFromServer(registry(signedAnon)));
    await assertFails(getDocFromServer(registry(identity("user-a", emailB))));
    await assertFails(getDocFromServer(registry(identity("user-a", emailA, "password", null, { email_verified: false }))));
    await assertFails(getDocFromServer(registry(google)));
    await assertFails(getDocFromServer(stock(google, A)));
    await assertFails(setDoc(grant(google), { googleSub: "google-ident-a" }));
    await assertFails(setDoc(grant(stale), { googleSub: "google-ident-a" }));
    await assertFails(setDoc(grant(password), { googleSub: "google-ident-b" }));
    await assertFails(setDoc(grant(password), { googleSub: "google-ident-a", extra: true }));
    await assertFails(setDoc(grant(password, "user-b"), { googleSub: "google-ident-a" }));
    await assertFails(setDoc(grant(identity("user-a", emailA)), { googleSub: "google-ident-a" }));
    await assertSucceeds(setDoc(grant(password), { googleSub: "google-ident-a" }));
    await checkRegistry(google);
    await checkA(google);
    await assertFails(getDocFromServer(registry(wrongGoogle)));
    await assertFails(getDocFromServer(stock(wrongGoogle, A)));
    await assertFails(getDocFromServer(stock(google, B)));
    await assertFails(updateDoc(grant(password), { googleSub: "google-ident-a" }));
    await assertFails(deleteDoc(grant(password)));

    // Continue to present the very same representative minted identity/token.
    await assertSucceeds(updateDoc(registry(admin), { enabled: false }));
    for (const lane of [password, google]) {
      await assertFails(getDocFromServer(registry(lane)));
      await assertFails(getDocFromServer(stock(lane, A)));
      await assertFails(updateDoc(stock(lane, A), { recorded: 13 }));
    }
    await assertSucceeds(updateDoc(registry(admin), { enabled: true }));
    await checkA(password);
    await assertSucceeds(deleteDoc(grant(admin)));
    await assertFails(getDocFromServer(stock(google, A)));
    await checkA(password);

    console.log("Registry rules: approved supplier access, cross-supplier isolation, explicit Google grant and immediate disallow after disable passed.");
  } finally {
    await env.cleanup();
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
