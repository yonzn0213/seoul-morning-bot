import { describe, it, expect } from "vitest";
import { getUser, putUser, deleteUser, listUsers } from "../src/store";
import type { Env, User } from "../src/types";

function fakeKV() {
  const m = new Map<string, string>();
  return {
    async get(k: string) { return m.has(k) ? m.get(k)! : null; },
    async put(k: string, v: string) { m.set(k, v); },
    async delete(k: string) { m.delete(k); },
    async list(opts?: { cursor?: string }) {
      return { keys: [...m.keys()].map((name) => ({ name })), list_complete: true, cursor: "" };
    },
  } as unknown as KVNamespace;
}

function env(): Env {
  return { USERS: fakeKV(), TELEGRAM_BOT_TOKEN: "t", DATA_GO_KR_KEY: "k", WEBHOOK_SECRET: "s" };
}

const U: User = { sido: "서울특별시", sigungu: "강남구", name: "철수" };

describe("store", () => {
  it("put -> get 라운드트립", async () => {
    const e = env();
    await putUser(e, "100", U);
    expect(await getUser(e, "100")).toEqual(U);
  });

  it("없는 유저는 null", async () => {
    expect(await getUser(env(), "999")).toBeNull();
  });

  it("delete는 존재 여부 반환", async () => {
    const e = env();
    await putUser(e, "100", U);
    expect(await deleteUser(e, "100")).toBe(true);
    expect(await deleteUser(e, "100")).toBe(false);
    expect(await getUser(e, "100")).toBeNull();
  });

  it("listUsers 전체 반환", async () => {
    const e = env();
    await putUser(e, "1", U);
    await putUser(e, "2", { ...U, sigungu: "서초구" });
    const all = await listUsers(e);
    expect(all.length).toBe(2);
    expect(all.map((x) => x.chatId).sort()).toEqual(["1", "2"]);
  });
});
