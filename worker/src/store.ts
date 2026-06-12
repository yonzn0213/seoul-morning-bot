import type { Env, User } from "./types";

export async function getUser(env: Env, chatId: string): Promise<User | null> {
  const v = await env.USERS.get(chatId);
  return v ? (JSON.parse(v) as User) : null;
}

export async function putUser(env: Env, chatId: string, user: User): Promise<void> {
  await env.USERS.put(chatId, JSON.stringify(user));
}

export async function deleteUser(env: Env, chatId: string): Promise<boolean> {
  const existed = (await env.USERS.get(chatId)) !== null;
  await env.USERS.delete(chatId);
  return existed;
}

export async function listUsers(env: Env): Promise<{ chatId: string; user: User }[]> {
  const out: { chatId: string; user: User }[] = [];
  let cursor: string | undefined;
  do {
    const res = await env.USERS.list({ cursor });
    for (const k of res.keys) {
      const v = await env.USERS.get(k.name);
      if (v) out.push({ chatId: k.name, user: JSON.parse(v) as User });
    }
    cursor = res.list_complete ? undefined : res.cursor;
  } while (cursor);
  return out;
}
