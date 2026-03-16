import { syncPeopleFromImmich } from "@/lib/people-sync";

async function main() {
  const result = await syncPeopleFromImmich();
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
