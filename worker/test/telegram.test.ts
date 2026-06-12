import { describe, it, expect, vi, afterEach } from "vitest";
import { sendMessage, answerCallback, editMessageText } from "../src/telegram";

afterEach(() => vi.unstubAllGlobals());

function mockFetchOk() {
  const fn = vi.fn(async () => new Response(JSON.stringify({ ok: true, result: {} })));
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("telegram", () => {
  it("sendMessage가 올바른 URL/바디로 호출", async () => {
    const fn = mockFetchOk();
    await sendMessage("TOK", "100", "안녕", { reply_markup: { inline_keyboard: [] } });
    const [url, init] = fn.mock.calls[0];
    expect(url).toBe("https://api.telegram.org/botTOK/sendMessage");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ chat_id: "100", text: "안녕", parse_mode: "HTML" });
    expect(body.reply_markup).toBeDefined();
  });

  it("answerCallback text 옵션", async () => {
    const fn = mockFetchOk();
    await answerCallback("TOK", "cb1", "완료!");
    const body = JSON.parse((fn.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toEqual({ callback_query_id: "cb1", text: "완료!" });
  });

  it("editMessageText 호출", async () => {
    const fn = mockFetchOk();
    await editMessageText("TOK", "100", 5, "수정됨");
    const [url, init] = fn.mock.calls[0];
    expect(url).toContain("editMessageText");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({ chat_id: "100", message_id: 5, text: "수정됨" });
  });

  it("ok:false면 예외", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ ok: false, description: "bad" }))));
    await expect(sendMessage("TOK", "100", "x")).rejects.toThrow();
  });
});
