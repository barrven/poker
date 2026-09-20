import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function readMain(): string {
  return fs.readFileSync(path.join(root, "src/main.ts"), "utf8");
}

test("the guest view's default is login-only: a fresh/unauthenticated load, a failed login, and logout all land on authView: \"login\"", () => {
  const main = readMain();
  // Every guest-view construction that is NOT specifically "the register
  // submission failed, stay on register" must default to "login" — the
  // one exception (register failure) is checked in its own test below.
  assert.match(main, /kind: "guest", authView: "login", error: ""\s*\}/); // initial load (no session) / logout
  assert.match(
    main,
    /kind: "guest", authView: "login", error: "API unreachable\. Is npm run dev running\?" \}/,
  );
  const onLoginBlock = main.match(/async function onLogin[\s\S]*?(?=\nasync function )/)?.[0];
  assert.ok(onLoginBlock, "onLogin function not found");
  assert.match(onLoginBlock, /kind: "guest", authView: "login"/);
  assert.doesNotMatch(onLoginBlock, /authView: "register"/);
});

test("a failed registration keeps authView on \"register\", never bouncing back to login", () => {
  const main = readMain();
  const onRegisterBlock = main.match(/async function onRegister[\s\S]*?(?=\nasync function )/)?.[0];
  assert.ok(onRegisterBlock, "onRegister function not found");
  assert.match(onRegisterBlock, /kind: "guest", authView: "register"/g);
  assert.doesNotMatch(onRegisterBlock, /authView: "login"/);
});

test("the guest view renders exactly one form at a time — login by default, register when authView is \"register\" — never both", () => {
  const main = readMain();
  // Both forms' markup exist as their own template strings (so each is
  // reachable), but render() picks one, it doesn't concatenate both.
  assert.match(main, /const registerForm = `/);
  assert.match(main, /const loginForm = `/);
  assert.match(main, /\$\{view\.authView === "register" \? registerForm : loginForm\}/);
  // Regression guard: the old always-both-forms markup is gone.
  assert.doesNotMatch(main, /<\/form>\s*<form id="login-form">/);
});

test("each auth form has a visible toggle to the other, wired to flip authView client-side with no API call", () => {
  const main = readMain();
  const registerBlock = main.match(/const registerForm = `[\s\S]*?`;/)?.[0];
  const loginBlock = main.match(/const loginForm = `[\s\S]*?`;/)?.[0];
  assert.ok(registerBlock && loginBlock, "registerForm/loginForm template not found");

  // AC3: register view has a visible link back to login.
  assert.match(registerBlock as string, /id="show-login"/);
  assert.match(registerBlock as string, /data-show-login/);
  // AC2: login view has a visible link to register.
  assert.match(loginBlock as string, /id="show-register"/);
  assert.match(loginBlock as string, /data-show-register/);

  const showLoginHandler = main.match(/#show-login"\)\?\.addEventListener\("click", \(\) => \{([\s\S]*?)\}\);/)?.[1];
  const showRegisterHandler = main.match(
    /#show-register"\)\?\.addEventListener\("click", \(\) => \{([\s\S]*?)\}\);/,
  )?.[1];
  assert.ok(showLoginHandler && showRegisterHandler, "toggle click handlers not found");
  assert.match(showLoginHandler as string, /authView: "login"/);
  assert.match(showRegisterHandler as string, /authView: "register"/);
  // Neither handler calls the api() helper or fetch — purely a local
  // view-state flip, not a network round trip.
  assert.doesNotMatch(showLoginHandler as string, /api\(|fetch\(/);
  assert.doesNotMatch(showRegisterHandler as string, /api\(|fetch\(/);
});

test("registration still signs the user straight in on success (the AC4 choice this feature made) — unchanged from feature 002", () => {
  const main = readMain();
  const onRegisterBlock = main.match(/async function onRegister[\s\S]*?(?=\nasync function )/)?.[0];
  assert.ok(onRegisterBlock, "onRegister function not found");
  assert.match(onRegisterBlock, /kind: "signed-in"/);
});

test("both forms still exist with their original ids/fields, and existing auth submit wiring is untouched", () => {
  const main = readMain();
  assert.match(main, /id="register-form"/);
  assert.match(main, /id="login-form"/);
  assert.match(main, /name="username"/);
  assert.match(main, /type="password"/);
  assert.match(main, /void onRegister\(event\.target as HTMLFormElement\)/);
  assert.match(main, /void onLogin\(event\.target as HTMLFormElement\)/);
});
