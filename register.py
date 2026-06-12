"""유저 등록/지역 선택 처리 (주기적으로 실행되어 새 메시지를 폴링)

- /start : 환영 + 지역 선택 키보드
- 지역 버튼 탭 : 지역 저장 (최초 1회면 등록 완료)
- /region : 지역 변경
- /stop : 알림 해지
"""

from common import (REGIONS, load_state, save_state, send_message,
                    region_keyboard, tg)

WELCOME = (
    "👋 안녕하세요! <b>서울 아침 브리핑 봇</b>이에요.\n"
    "매일 아침 7시, 선택하신 지역의 비 소식과 미세먼지를 알려드립니다.\n\n"
    "먼저 지역을 선택해주세요 👇"
)

HELP = (
    "✅ 매일 아침 7시에 <b>{region}</b> 브리핑을 보내드리고 있어요.\n\n"
    "/region — 지역 변경\n"
    "/stop — 알림 해지"
)


def handle_message(state: dict, msg: dict):
    chat_id = str(msg["chat"]["id"])
    text = (msg.get("text") or "").strip()
    users = state["users"]

    if text == "/stop":
        if users.pop(chat_id, None):
            send_message(chat_id, "알림을 해지했어요. 다시 받고 싶으면 /start 를 보내주세요. 👋")
        else:
            send_message(chat_id, "등록된 알림이 없어요. /start 로 시작할 수 있어요.")
        return

    if text in ("/start", "/region") or chat_id not in users:
        send_message(chat_id, WELCOME if chat_id not in users else "변경할 지역을 선택해주세요 👇",
                     reply_markup=region_keyboard())
        return

    # 등록된 유저의 일반 메시지
    send_message(chat_id, HELP.format(region=users[chat_id]["region"]))


def handle_callback(state: dict, cq: dict):
    data = cq.get("data", "")
    chat_id = str(cq["message"]["chat"]["id"])

    if not data.startswith("r:"):
        tg("answerCallbackQuery", {"callback_query_id": cq["id"]})
        return

    region = data[2:]
    if region not in REGIONS:
        tg("answerCallbackQuery", {"callback_query_id": cq["id"], "text": "알 수 없는 지역이에요."})
        return

    is_new = chat_id not in state["users"]
    state["users"][chat_id] = {
        "region": region,
        "name": cq["from"].get("first_name", ""),
    }
    tg("answerCallbackQuery", {"callback_query_id": cq["id"], "text": f"{region} 설정 완료!"})

    # 키보드 메시지를 확정 문구로 교체
    tg("editMessageText", {
        "chat_id": chat_id,
        "message_id": cq["message"]["message_id"],
        "text": f"📍 <b>{region}</b>로 설정했어요!",
        "parse_mode": "HTML",
    })

    if is_new:
        send_message(chat_id,
                     f"등록 완료! 내일 아침 7시부터 <b>{region}</b> 브리핑을 보내드릴게요. 🌅\n"
                     "지역 변경은 /region, 해지는 /stop")
    else:
        send_message(chat_id, f"이제부터 <b>{region}</b> 기준으로 알려드릴게요!")


def main():
    state = load_state()
    before = (state["offset"], repr(state["users"]))

    res = tg("getUpdates", {"offset": state["offset"] + 1, "timeout": 0})
    updates = res["result"]
    print(f"새 업데이트 {len(updates)}건")

    for u in updates:
        state["offset"] = max(state["offset"], u["update_id"])
        try:
            if "message" in u:
                handle_message(state, u["message"])
            elif "callback_query" in u:
                handle_callback(state, u["callback_query"])
        except Exception as e:
            print(f"업데이트 {u['update_id']} 처리 실패: {e}")

    if (state["offset"], repr(state["users"])) != before:
        save_state(state)
        print("state.json 갱신됨")


if __name__ == "__main__":
    main()
