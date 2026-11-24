import "dotenv/config";
import assert from "node:assert/strict";

const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
function password(option) {
  const value = process.argv.find(argument => argument.startsWith(`--${option}=`))?.slice(option.length + 3);
  if (!value) throw new Error(`Missing --${option}=...`);
  return value;
}
const accounts = [
  { portal: "customer", email: "anna@example.test", password: password("customer-password") },
  { portal: "cleaner", email: "leonie@example.test", password: password("cleaner-password") },
  { portal: "admin", email: "admin@example.test", password: password("admin-password") }
];

async function login(account) {
  return fetch(new URL("/api/auth/login", base), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(account),
    redirect: "manual"
  });
}

for (const account of accounts) {
  const anonymous = await fetch(new URL(`/${account.portal}`, base), { redirect: "manual" });
  assert.equal(anonymous.status, 307, `anonymous ${account.portal} access`);
  const response = await login(account);
  assert.equal(response.status, 200, `${account.portal} login`);
  const cookie = response.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("nova_demo_session="), `${account.portal} session cookie`);
  const own = await fetch(new URL(`/${account.portal}`, base), { headers: { cookie }, redirect: "manual" });
  assert.equal(own.status, 200, `${account.portal} portal access`);
  const other = account.portal === "customer" ? "cleaner" : "customer";
  const cross = await fetch(new URL(`/${other}`, base), { headers: { cookie }, redirect: "manual" });
  assert.equal(cross.status, 307, `${account.portal} cross-portal denial`);
  const logout = await fetch(new URL("/api/auth/logout", base), { method: "POST", headers: { cookie }, redirect: "manual" });
  assert.equal(logout.status, 303, `${account.portal} logout`);
  const after = await fetch(new URL(`/${account.portal}`, base), { headers: { cookie }, redirect: "manual" });
  assert.equal(after.status, 307, `${account.portal} revoked session`);
  console.log(`${account.portal}: sign-in, scope, and sign-out passed`);
}

const invalid = await login({ ...accounts[0], password: "incorrect" });
assert.equal(invalid.status, 401, "invalid password rejected");
const invalidAdmin = await login({ ...accounts[2], password: "incorrect" });
assert.equal(invalidAdmin.status, 401, "invalid admin password rejected");
console.log("invalid customer and admin passwords rejected");
