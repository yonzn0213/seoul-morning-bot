export interface Env {
  USERS: KVNamespace;
  TELEGRAM_BOT_TOKEN: string;
  DATA_GO_KR_KEY: string;
  WEBHOOK_SECRET: string;
}

export interface User {
  sido: string;
  sigungu: string;
  name: string;
}

export interface TgChat { id: number | string; }
export interface TgUser { first_name?: string; }
export interface TgMessage { chat: TgChat; message_id: number; text?: string; }
export interface TgCallback {
  id: string;
  data?: string;
  message: TgMessage;
  from?: TgUser;
}
export interface TgUpdate {
  message?: TgMessage;
  callback_query?: TgCallback;
}

export interface InlineButton { text: string; callback_data: string; }
export interface InlineKeyboard { inline_keyboard: InlineButton[][]; }
