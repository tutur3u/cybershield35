/** Separate processes avoid both cross-file module mocks and VM teardown crashes. */
const files = [...new Bun.Glob("**/*.test.{ts,tsx,js,jsx}").scanSync({cwd:"test"})].sort();
let failed = 0;
for (const file of files) {
 const child = Bun.spawn([process.execPath,"test",`test/${file}`],{stdout:"inherit",stderr:"inherit"});
 if (await child.exited !== 0) failed++;
}
console.log(`Isolated test files: ${files.length - failed} passed, ${failed} failed`);
if (failed) process.exitCode = 1;
