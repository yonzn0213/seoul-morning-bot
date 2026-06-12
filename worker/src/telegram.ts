async function tgCall(token: string, method: string, payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as { ok: boolean };
  if (!data.ok) throw new Error(`telegram ${method} 실패: ${JSON.stringify(data)}`);
  return data;
}

export function sendMessage(token: string, chatId: string, text: string, extra: Record<string, unknown> = {}) {
  return tgCall(token, "sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

export function answerCallback(token: string, callbackId: string, text?: string) {
  return tgCall(token, "answerCallbackQuery", { callback_query_id: callbackId, ...(text ? { text } : {}) });
}

export function editMessageText(token: string, chatId: string, messageId: number, text: string, extra: Record<string, unknown> = {}) {
  return tgCall(token, "editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", ...extra });
}
